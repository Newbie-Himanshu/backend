import crypto from "crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
    capturePaymentWorkflow,
    createOrderShipmentWorkflow,
    markOrderFulfillmentAsDeliveredWorkflow,
} from "@medusajs/medusa/core-flows"
import { sendOrderDeliveredWorkflow } from "../../../workflows/send-order-delivered"
import { sendOrderShippedWorkflow } from "../../../workflows/send-order-shipped"
import { sendOrderInTransitWorkflow } from "../../../workflows/send-order-in-transit"
import { sendOrderOutForDeliveryWorkflow } from "../../../workflows/send-order-out-for-delivery"

/**
 * POST /hooks/shiprocket
 *
 * Shiprocket webhook handler — syncs shipment status to Medusa admin panel
 * AND sends customer-facing emails for every status event.
 *
 * Register this URL in: Shiprocket Dashboard → Settings → Webhooks
 *   Dev:  https://<ngrok-url>/hooks/shiprocket?token=<SHIPROCKET_WEBHOOK_TOKEN>
 *   Prod: https://admin.vridhira.in/hooks/shiprocket?token=<SHIPROCKET_WEBHOOK_TOKEN>
 *
 * ┌─────────────────────┬──────────────────────────────┬──────────────────────────────────┐
 * │ Shiprocket status   │ Admin panel effect           │ Customer email                   │
 * ├─────────────────────┼──────────────────────────────┼──────────────────────────────────┤
 * │ Shipped             │ Fulfillment → "Shipped"      │ Shipped email (AWB + tracking)   │
 * │ In Transit          │ Metadata: shiprocket_status  │ In-transit email (last city)     │
 * │ Out for Delivery    │ Metadata: shiprocket_status  │ Out-for-delivery email           │
 * │ Delivered           │ Fulfillment → "Delivered"    │ Delivered email (review CTA)     │
 * │                     │ Order → "Completed"          │                                  │
 * └─────────────────────┴──────────────────────────────┴──────────────────────────────────┘
 *
 * Shiprocket payload shape:
 *   {
 *     awb: "1234567890",
 *     current_status: "Delivered" | "Shipped" | "In Transit" | "Out for Delivery" | ...
 *     order_id: 456789,          -- Shiprocket's own internal ID (ignore this)
 *     channel_order_id: "101",   -- the order_id WE sent = our display_id
 *     courier_name: "BlueDart",
 *     current_city: "Mumbai",
 *     etd: "2024-01-15",
 *   }
 *
 * Authentication:
 *   Register the webhook URL with a secret token query param.
 *   Set SHIPROCKET_WEBHOOK_TOKEN in your .env and in Shiprocket Dashboard → Settings → Webhooks.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    try {
        // ── Token authentication ─────────────────────────────────────────────
        // SECURITY: Token is ALWAYS required. If the env var is not set, the webhook
        // is fully open — any actor can forge delivery events and complete orders.
        // Fail loud so the operator knows to configure the token immediately.
        const expectedToken = process.env.SHIPROCKET_WEBHOOK_TOKEN
        if (!expectedToken) {
            console.error("[Shiprocket Webhook] SHIPROCKET_WEBHOOK_TOKEN is not configured — rejecting all requests. Set this env var and register the token in Shiprocket Dashboard → Settings → Webhooks.")
            // Return 200 so Shiprocket doesn't retry, but reject processing
            return res.status(200).json({ received: false, error: "Webhook not configured" })
        }

        const receivedToken = (req.query as Record<string, string>).token ?? ""
        // Constant-time comparison to prevent timing-oracle on the token value
        const expectedBuf = Buffer.from(expectedToken)
        const receivedBuf = Buffer.from(receivedToken)
        const isValidToken =
            receivedBuf.length === expectedBuf.length &&
            crypto.timingSafeEqual(receivedBuf, expectedBuf)

        if (!isValidToken) {
            console.warn("[Shiprocket Webhook] Invalid or missing token — rejected")
            return res.status(401).json({ received: false, error: "Unauthorized" })
        }

        const {
            awb,
            current_status,
            // channel_order_id = the order_id WE sent to Shiprocket (= our display_id)
            // order_id         = Shiprocket's own internal ID (useless to us)
            channel_order_id,
            courier_name,
            etd,
            current_city,  // last scan city — included in in-transit email
        } = req.body as {
            awb?: string
            current_status?: string
            channel_order_id?: string
            courier_name?: string
            etd?: string
            current_city?: string
        }

        console.log(`[Shiprocket Webhook] Status: ${current_status} | Channel Order: ${channel_order_id} | AWB: ${awb}`)

        if (!channel_order_id || !current_status) {
            return res.status(400).json({ error: "Missing channel_order_id or current_status" })
        }

        // ── Status routing ──────────────────────────────────────────────────
        // Map Shiprocket status strings to our email events.
        // All comparisons are lowercase to handle Shiprocket's inconsistent casing.
        const status = current_status.toLowerCase().trim()
        type EmailEvent = "shipped" | "in_transit" | "out_for_delivery" | "delivered" | null

        const emailEvent: EmailEvent = (() => {
            if (status === "shipped")                           return "shipped"
            if (status === "in transit" || status === "in-transit") return "in_transit"
            if (status === "out for delivery" || status === "out_for_delivery") return "out_for_delivery"
            if (status === "delivered")                         return "delivered"
            return null
        })()

        if (!emailEvent) {
            console.log(`[Shiprocket Webhook] Status "${current_status}" has no email action — skipping`)
            return res.status(200).json({ received: true })
        }

        // NOTE: RESEND_API_KEY absence only skips emails — fulfillment state changes
        // (mark shipped / mark delivered) and COD payment capture must ALWAYS run.
        // Do NOT early-return here; the email guard is applied per-event below.
        const emailEnabled = !!process.env.RESEND_API_KEY
        if (!emailEnabled) {
            console.log("[Shiprocket Webhook] RESEND_API_KEY not set — emails will be skipped but fulfillment/capture will proceed")
        }

        // Look up the Medusa order by display_id
        const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

        const displayId = parseInt(channel_order_id, 10)
        if (isNaN(displayId)) {
            console.warn(`[Shiprocket Webhook] Could not parse display_id from channel_order_id "${channel_order_id}"`)
            return res.status(200).json({ received: true })
        }

        const { data: orders } = await query.graph({
            entity: "order",
            fields: [
                "id", "display_id", "email", "metadata",
                "status",
                // For createOrderShipmentWorkflow — needs fulfillment_id
                "fulfillments.id",
                "fulfillments.shipped_at",
                "fulfillments.delivered_at",
                // For createOrderShipmentWorkflow — needs order line item IDs
                "items.id",
                "items.quantity",
                // For COD auto-capture on delivery — need payment IDs and provider
                "payment_collections.id",
                "payment_collections.payments.id",
                "payment_collections.payments.provider_id",
                "payment_collections.payments.captured_at",
            ],
            filters: { display_id: displayId } as any,
        })

        if (!orders || orders.length === 0) {
            console.warn(`[Shiprocket Webhook] No order found for display_id ${displayId}`)
            return res.status(200).json({ received: true })
        }

        const order = orders[0]
        const fulfillment = (order as any).fulfillments?.[0]
        const orderItems: { id: string; quantity: number }[] =
            ((order as any).items || []).map((i: any) => ({ id: i.id, quantity: i.quantity }))

        console.log(`[Shiprocket Webhook] Matched Medusa order ${order.id} (display #${order.display_id}) | fulfillment: ${fulfillment?.id ?? "none"}`)

        const trackingUrl = awb ? `https://shiprocket.co/tracking/${awb}` : undefined
        const emailInput  = { id: order.id as string, awb, courier_name, tracking_url: trackingUrl }

        // ── Helper: persist Shiprocket tracking info to order metadata ───────────
        // Visible in admin panel under the order's "Metadata" section.
        const updateTrackingMetadata = async (extra: Record<string, string | undefined>) => {
            try {
                const orderModule = req.scope.resolve(Modules.ORDER) as any
                await orderModule.updateOrders([{
                    id: order.id,
                    metadata: {
                        ...(order as any).metadata,
                        shiprocket_status:       current_status,
                        shiprocket_awb:          awb           ?? (order as any).metadata?.shiprocket_awb,
                        shiprocket_courier:      courier_name  ?? (order as any).metadata?.shiprocket_courier,
                        shiprocket_tracking_url: trackingUrl   ?? (order as any).metadata?.shiprocket_tracking_url,
                        shiprocket_updated_at:   new Date().toISOString(),
                        ...extra,
                    },
                }])
                console.log(`[Shiprocket Webhook] Metadata updated for order ${order.id}`)
            } catch (err) {
                // Metadata update is non-critical — log and continue
                console.error(`[Shiprocket Webhook] Metadata update failed for order ${order.id}:`, (err as Error).message)
            }
        }

        // ── Status routing ────────────────────────────────────────────────────────
        if (emailEvent === "shipped") {
            if (!awb) {
                console.warn(`[Shiprocket Webhook] "shipped" event missing AWB — skipping`)
                return res.status(200).json({ received: true })
            }

            // 1. Customer email — idempotency guard prevents duplicate emails on webhook retry
            const alreadySentShippedEmail = !!(order as any).metadata?.shiprocket_email_shipped_at
            if (emailEnabled && !alreadySentShippedEmail) {
                await sendOrderShippedWorkflow(req.scope).run({ input: emailInput })
                console.log(`[Shiprocket Webhook] Shipped email → order ${order.id} | AWB: ${awb}`)
            } else if (alreadySentShippedEmail) {
                console.log(`[Shiprocket Webhook] Shipped email already sent for order ${order.id} — skipping duplicate`)
            } else {
                console.log(`[Shiprocket Webhook] Email skipped (RESEND not configured) — order ${order.id}`)
            }

            // 2. Mark fulfillment as "Shipped" in Medusa admin panel
            if (fulfillment?.id && !fulfillment.shipped_at) {
                try {
                    await createOrderShipmentWorkflow(req.scope).run({
                        input: {
                            order_id:       order.id as string,
                            fulfillment_id: fulfillment.id,
                            items:          orderItems,
                        },
                    })
                    console.log(`[Shiprocket Webhook] Admin panel: fulfillment ${fulfillment.id} marked as Shipped`)
                } catch (err) {
                    // Might fail if shipment was already created — not fatal
                    console.warn(`[Shiprocket Webhook] createOrderShipment failed (may already be shipped):`, (err as Error).message)
                }
            } else if (!fulfillment?.id) {
                console.warn(`[Shiprocket Webhook] No fulfillment found on order ${order.id} — admin state not updated`)
            }

            // 3. Metadata (stores AWB, courier, tracking URL + idempotency timestamp)
            await updateTrackingMetadata({
                shiprocket_shipped_at:       new Date().toISOString(),
                shiprocket_email_shipped_at: alreadySentShippedEmail
                    ? (order as any).metadata?.shiprocket_email_shipped_at
                    : new Date().toISOString(),
            })

        } else if (emailEvent === "in_transit") {

            // 1. Customer email — idempotency guard
            const alreadySentInTransitEmail = !!(order as any).metadata?.shiprocket_email_in_transit_at
            if (emailEnabled && !alreadySentInTransitEmail) {
                await sendOrderInTransitWorkflow(req.scope).run({
                    input: { ...emailInput, current_city },
                })
                console.log(`[Shiprocket Webhook] In-transit email → order ${order.id}${current_city ? ` | City: ${current_city}` : ""}`)
            } else if (alreadySentInTransitEmail) {
                console.log(`[Shiprocket Webhook] In-transit email already sent for order ${order.id} — skipping duplicate`)
            } else {
                console.log(`[Shiprocket Webhook] Email skipped (RESEND not configured) — order ${order.id}`)
            }

            // 2. Metadata (no native Medusa state for in-transit — stored in metadata)
            await updateTrackingMetadata({
                shiprocket_current_city:           current_city,
                shiprocket_email_in_transit_at:    alreadySentInTransitEmail
                    ? (order as any).metadata?.shiprocket_email_in_transit_at
                    : new Date().toISOString(),
            })

        } else if (emailEvent === "out_for_delivery") {

            // 1. Customer email — idempotency guard
            const alreadySentOFDEmail = !!(order as any).metadata?.shiprocket_email_out_for_delivery_at
            if (emailEnabled && !alreadySentOFDEmail) {
                await sendOrderOutForDeliveryWorkflow(req.scope).run({ input: emailInput })
                console.log(`[Shiprocket Webhook] Out-for-delivery email → order ${order.id}`)
            } else if (alreadySentOFDEmail) {
                console.log(`[Shiprocket Webhook] Out-for-delivery email already sent for order ${order.id} — skipping duplicate`)
            } else {
                console.log(`[Shiprocket Webhook] Email skipped (RESEND not configured) — order ${order.id}`)
            }

            // 2. Metadata
            await updateTrackingMetadata({
                shiprocket_out_for_delivery_at:       new Date().toISOString(),
                shiprocket_email_out_for_delivery_at: alreadySentOFDEmail
                    ? (order as any).metadata?.shiprocket_email_out_for_delivery_at
                    : new Date().toISOString(),
            })

        } else if (emailEvent === "delivered") {

            // 1. Customer email — idempotency guard
            const alreadySentDeliveredEmail = !!(order as any).metadata?.shiprocket_email_delivered_at
            if (emailEnabled && !alreadySentDeliveredEmail) {
                await sendOrderDeliveredWorkflow(req.scope).run({ input: { id: order.id as string } })
                console.log(`[Shiprocket Webhook] Delivered email → order ${order.id}`)
            } else if (alreadySentDeliveredEmail) {
                console.log(`[Shiprocket Webhook] Delivered email already sent for order ${order.id} — skipping duplicate`)
            } else {
                console.log(`[Shiprocket Webhook] Email skipped (RESEND not configured) — order ${order.id}`)
            }

            // 2. Metadata — updated BEFORE markOrderFulfillmentAsDeliveredWorkflow.
            //    That workflow dispatches order.fulfillment_delivered, which triggers
            //    the order-delivered-email.ts subscriber. That subscriber checks
            //    metadata.shiprocket_email_delivered_at to avoid a duplicate email.
            //    Updating metadata here (before the workflow) guarantees the flag is
            //    already present by the time the event fires.
            await updateTrackingMetadata({
                shiprocket_delivered_at:       new Date().toISOString(),
                shiprocket_email_delivered_at: alreadySentDeliveredEmail
                    ? (order as any).metadata?.shiprocket_email_delivered_at
                    : new Date().toISOString(),
            })

            // 3. Mark fulfillment as "Delivered" in Medusa admin panel
            //    This also marks the order as "Completed".
            //    NOTE: This dispatches order.fulfillment_delivered — the
            //    order-delivered-email.ts subscriber will check metadata (set above)
            //    and skip sending a duplicate email for Shiprocket-driven deliveries.
            if (fulfillment?.id && !fulfillment.delivered_at) {
                try {
                    await markOrderFulfillmentAsDeliveredWorkflow(req.scope).run({
                        input: {
                            orderId:       order.id as string,
                            fulfillmentId: fulfillment.id,
                        },
                    })
                    console.log(`[Shiprocket Webhook] Admin panel: fulfillment ${fulfillment.id} marked as Delivered — order Completed`)
                } catch (err) {
                    // Might fail if already delivered — not fatal
                    console.warn(`[Shiprocket Webhook] markOrderFulfillmentAsDelivered failed (may already be delivered):`, (err as Error).message)
                }
            } else if (!fulfillment?.id) {
                console.warn(`[Shiprocket Webhook] No fulfillment found on order ${order.id} — admin state not updated`)
            }

            // 4. Auto-capture COD payment
            //
            // Industry-standard COD flow:
            //   order.placed → authorizePayment (status: authorized)
            //   courier delivers + collects cash → Shiprocket fires "Delivered" webhook
            //                                    → capturePayment (status: captured)
            //
            // "Delivered" is the only trusted signal that cash was physically collected.
            // Medusa admin will show payment as "Captured" only after this call.
            // Without it the payment stays "Authorized" forever and you have no
            // programmatic record that money changed hands.
            const allPayments: any[] = (order as any).payment_collections
                ?.flatMap((pc: any) => pc.payments ?? []) ?? []

            const codPaymentsToCaptured = allPayments.filter(
                (p: any) =>
                    // Only COD payments — not Razorpay or other providers
                    (p.provider_id === "pp_cod_cod" || p.provider_id === "cod") &&
                    // Skip if already captured (idempotency — Shiprocket may retry)
                    !p.captured_at
            )

            for (const payment of codPaymentsToCaptured) {
                try {
                    await capturePaymentWorkflow(req.scope).run({
                        input: { payment_id: payment.id },
                    })
                    console.log(
                        `[Shiprocket Webhook] COD payment ${payment.id} captured for order ${order.id} — cash collected on delivery`
                    )
                } catch (captureErr) {
                    // Non-fatal: log for manual follow-up but do not block the response.
                    // The fulfillment is already marked delivered — a capture failure here
                    // means admin should manually capture in Medusa Admin › Payments.
                    console.error(
                        `[Shiprocket Webhook] Failed to auto-capture COD payment ${payment.id} for order ${order.id}:`,
                        (captureErr as Error).message
                    )
                }
            }

            if (codPaymentsToCaptured.length === 0) {
                // Either not a COD order (Razorpay — already captured by plugin) or already captured.
                console.log(`[Shiprocket Webhook] No COD payments pending capture for order ${order.id}`)
            }
        }

        return res.status(200).json({ received: true })

    } catch (error) {
        console.error("[Shiprocket Webhook] Error:", (error as Error).message)
        // Always return 200 so Shiprocket doesn't retry indefinitely
        return res.status(200).json({ received: true, error: "Internal error — logged" })
    }
}
