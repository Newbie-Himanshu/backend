import crypto from "crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendOrderRefundedWorkflow } from "../../../workflows/send-order-refunded"

/**
 * POST /hooks/razorpay
 *
 * Razorpay webhook handler — handles payment lifecycle events.
 * Register at: Razorpay Dashboard → Settings → Webhooks
 *
 * URL (dev):  https://<ngrok-url>/hooks/razorpay
 * URL (prod): https://admin.vridhira.in/hooks/razorpay
 *
 * Events handled:
 * ┌──────────────────────┬─────────────────────────────────────────────────┐
 * │ Event                │ Action                                          │
 * ├──────────────────────┼─────────────────────────────────────────────────┤
 * │ payment.authorized   │ Log — medusa-plugin-razorpay-v2 handles capture │
 * │ payment.captured     │ Log — order fulfillment can now begin           │
 * │ payment.failed       │ Log — customer may retry                        │
 * │ refund.processed     │ Look up order → send refund-initiated email     │
 * └──────────────────────┴─────────────────────────────────────────────────┘
 *
 * SECURITY: Webhook signature is verified via HMAC-SHA256 using RAZORPAY_WEBHOOK_SECRET
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    try {
        // ── 1. Signature Verification ──────────────────────────────────────
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
        if (!webhookSecret) {
            console.error("[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not set — rejecting request")
            return res.status(500).json({ error: "Webhook secret not configured" })
        }

        const receivedSignature = req.headers["x-razorpay-signature"] as string | undefined
        if (!receivedSignature) {
            console.warn("[Razorpay Webhook] Missing x-razorpay-signature header")
            return res.status(400).json({ error: "Missing signature" })
        }

        // Razorpay signs the exact raw HTTP body bytes.
        // Medusa v2's body-parser middleware preserves the original buffer as req.rawBody.
        // Falling back to re-serialized JSON is UNSAFE (key order / whitespace may differ),
        // so we reject the request if rawBody is unavailable rather than risk a bypass.
        const rawBodyBuffer = (req as any).rawBody as Buffer | string | undefined
        if (!rawBodyBuffer) {
            console.error("[Razorpay Webhook] req.rawBody is unavailable — cannot verify signature safely. Ensure Medusa's rawBody middleware is active.")
            return res.status(500).json({ error: "Raw body unavailable — signature cannot be verified" })
        }
        const bodyForHmac = Buffer.isBuffer(rawBodyBuffer)
            ? rawBodyBuffer
            : Buffer.from(rawBodyBuffer, "utf8")

        const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(bodyForHmac)
            .digest("hex")

        // Validate that the received signature looks like a valid 64-char lowercase hex string.
        // Buffer.from(str, "hex") silently truncates invalid characters, which could
        // produce a wrong-length buffer and defeat the length guard below.
        if (!/^[0-9a-fA-F]{64}$/.test(receivedSignature)) {
            console.warn("[Razorpay Webhook] Signature has invalid format — request rejected")
            return res.status(400).json({ error: "Invalid signature" })
        }

        // Compare the hex-string bytes directly (UTF-8) rather than their decoded values.
        // This is the safest constant-time approach: both strings are exactly 64 chars,
        // so the UTF-8 buffers are always the same length — no padding or truncation risk.
        const sigBuf = Buffer.from(receivedSignature.toLowerCase(), "utf8")
        const expBuf = Buffer.from(expectedSignature.toLowerCase(), "utf8")

        if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
            console.warn("[Razorpay Webhook] Signature mismatch — request rejected")
            return res.status(400).json({ error: "Invalid signature" })
        }

        // ── 2. Event Routing ─────────────────────────────────────────────
        const body          = req.body as unknown as Record<string, any>
        const event         = body?.event as string | undefined
        const paymentEntity = body?.payload?.payment?.entity as Record<string, any> | undefined
        const refundEntity  = body?.payload?.refund?.entity  as Record<string, any> | undefined

        console.log(`[Razorpay Webhook] Event: ${event}`)

        switch (event) {
            case "payment.authorized":
                console.log(`[Razorpay Webhook] Payment authorized — id: ${paymentEntity?.id} | amount: ₹${(paymentEntity?.amount ?? 0) / 100}`)
                break

            case "payment.captured":
                console.log(`[Razorpay Webhook] Payment captured — id: ${paymentEntity?.id} | order_id: ${paymentEntity?.order_id}`)
                break

            case "payment.failed":
                console.warn(`[Razorpay Webhook] Payment failed — id: ${paymentEntity?.id} | error: ${paymentEntity?.error_description}`)
                break

            case "refund.processed":
                await handleRefundProcessed({
                    req,
                    refundEntity,
                    paymentEntity,
                })
                break

            default:
                console.log(`[Razorpay Webhook] Unhandled event type: ${event} — acknowledged but not processed`)
        }

        // Always return 200 so Razorpay doesn't keep retrying
        return res.status(200).json({ received: true, event })

    } catch (error) {
        console.error("[Razorpay Webhook] Unhandled error:", (error as Error).message)
        // Still 200 — avoid Razorpay retrying a transient server error
        return res.status(200).json({ received: true, warning: "Processing error logged" })
    }
}

// ── Refund Handler ────────────────────────────────────────────────────────────

/**
 * Handle refund.processed event:
 * 1. Find the Medusa order linked to the Razorpay payment_id
 * 2. Find any open `return` to get its ID (for the workflow)
 * 3. Run send-order-refunded workflow → sends refund email to customer
 *
 * If no return exists (edge case: direct refund without a formal return),
 * we still send the email by building a synthetic return context.
 */
async function handleRefundProcessed({
    req,
    refundEntity,
    paymentEntity,
}: {
    req: MedusaRequest
    refundEntity?: Record<string, any>
    paymentEntity?: Record<string, any>
}) {
    const razorpayPaymentId = refundEntity?.payment_id ?? paymentEntity?.id
    const refundId          = refundEntity?.id
    const refundAmount      = refundEntity?.amount ?? 0  // in paise

    console.log(`[Razorpay Webhook] Refund processed — refund_id: ${refundId} | payment_id: ${razorpayPaymentId} | amount: ₹${refundAmount / 100}`)

    if (!razorpayPaymentId) {
        console.warn("[Razorpay Webhook] refund.processed event missing payment_id — cannot look up order")
        return
    }

    try {
        const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

        // ── Look up Medusa payment by Razorpay payment ID ─────────────────
        // The medusa-plugin-razorpay-v2 stores the Razorpay payment ID inside
        // payment.data.id (the JSON session data blob).
        // Filter by: (1) provider_id to scope to Razorpay only, and
        //            (2) created_at within Razorpay's 6-month refund window.
        // The time filter removes the need for an arbitrary take cap — any payment
        // eligible for a refund must have been created within the last 180 days.
        const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
        const { data: payments } = await query.graph({
            entity: "payment",
            fields: ["id", "payment_collection_id", "data"],
            filters: {
                provider_id: "pp_razorpay_razorpay",
                created_at: { $gte: sixMonthsAgo },
            } as any,
        })

        // Fine-grained JS match on JSONB data — scoped to Razorpay payments only
        const matchedPayment = payments.find(
            (p: any) =>
                p?.data?.id === razorpayPaymentId ||
                p?.data?.razorpay_payment_id === razorpayPaymentId
        )

        if (!matchedPayment) {
            console.warn(
                `[Razorpay Webhook] No Medusa payment found for Razorpay payment_id ${razorpayPaymentId} — cannot send refund email`
            )
            return
        }

        // ── Find the order via payment_collection → order link ────────────
        const { data: collections } = await query.graph({
            entity: "payment_collection",
            fields: ["id", "order.*"],
            filters: { id: matchedPayment.payment_collection_id },
        })

        const order = (collections[0] as any)?.order
        if (!order?.id) {
            console.warn(`[Razorpay Webhook] No order linked to payment_collection ${matchedPayment.payment_collection_id}`)
            return
        }

        console.log(`[Razorpay Webhook] Refund mapped to Medusa order ${order.id} (display #${order.display_id})`)

        // ── Find a return linked to this order ────────────────────────────
        const { data: returns } = await query.graph({
            entity: "return",
            fields: ["id", "refund_amount", "created_at"],
            filters: { order_id: order.id },
        })

        if (returns.length > 0) {
            // Sort by created_at descending — DB does not guarantee insertion order.
            // Using [...returns] to avoid mutating the original array from query.graph.
            const sortedReturns = [...returns].sort(
                (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
            const latestReturn = sortedReturns[0] as any
            console.log(`[Razorpay Webhook] Sending refund email for return ${latestReturn.id}`)

            await sendOrderRefundedWorkflow(req.scope).run({
                input: { id: latestReturn.id },
            })
        } else {
            // No formal return exists (direct refund from Razorpay dashboard).
            // Trigger the workflow with a synthetic return-like input by invoking
            // the notification step directly.
            console.log(
                `[Razorpay Webhook] No return record for order ${order.id} — sending direct refund notification`
            )
            // Razorpay sends amounts in paise; convert to rupees for the email template.
            // The template's fmt() function treats its input as the major currency unit (rupees).
            // Passing raw paise (e.g. 50000) would display ₹50,000 instead of ₹500.
            await sendOrderRefundedWorkflow(req.scope).run({
                input: { id: order.id, directRefundAmount: refundAmount / 100, isDirectRefund: true },
            })
        }

    } catch (err) {
        // Email errors must never block the 200 acknowledgment
        console.error("[Razorpay Webhook] Error sending refund email:", (err as Error).message)
    }
}
