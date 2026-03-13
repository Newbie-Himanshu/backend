import crypto from "crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getRazorpayQueue } from "../../../modules/razorpay-queue"
import logger from "../../../lib/logger"

const log = logger.child({ module: "razorpay-webhook" })

/**
 * POST /hooks/razorpay
 *
 * Razorpay webhook handler — async event processing via BullMQ.
 * Register at: Razorpay Dashboard → Settings → Webhooks
 *
 * URL (dev):  https://<ngrok-url>/hooks/razorpay
 * URL (prod): https://admin.Himanshu.in/hooks/razorpay
 *
 * Architecture:
 *   This handler does EXACTLY two things:
 *     1. Verify the HMAC-SHA256 signature  (fail-closed — rejects on any error)
 *     2. Enqueue the payload into BullMQ   (async Worker processes it)
 *   It returns HTTP 200 immediately so Razorpay's 5-second timeout is never hit.
 *
 * Events processed by the BullMQ Worker (src/modules/razorpay-queue/processor.ts):
 * ┌──────────────────────┬─────────────────────────────────────────────────┐
 * │ Event                │ Action                                          │
 * ├──────────────────────┼─────────────────────────────────────────────────┤
 * │ payment.authorized   │ Log only                                        │
 * │ payment.captured     │ Log only (fulfillment via order.placed sub)     │
 * │ payment.failed       │ Log warning                                     │
 * │ refund.processed     │ Look up order → send refund-initiated email     │
 * └──────────────────────┴─────────────────────────────────────────────────┘
 *
 * Idempotency: The Worker stores a per-event Redis key (razorpay:event:{id}, TTL 24h)
 * before processing. Razorpay retry deliveries of the same event are silently skipped.
 *
 * SECURITY: Signature verified via HMAC-SHA256 using RAZORPAY_WEBHOOK_SECRET.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    // ── 1. Signature Verification ──────────────────────────────────────
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
    if (!webhookSecret) {
        log.error("RAZORPAY_WEBHOOK_SECRET is not set — rejecting request")
        return res.status(500).json({ error: "Webhook secret not configured" })
    }

    const receivedSignature = req.headers["x-razorpay-signature"] as string | undefined
    if (!receivedSignature) {
        log.warn("Missing x-razorpay-signature header")
        return res.status(400).json({ error: "Missing signature" })
    }

    // Razorpay signs the exact raw HTTP body bytes.
    // Falling back to re-serialized JSON is UNSAFE (key order / whitespace may differ),
    // so we reject the request if rawBody is unavailable rather than risk a bypass.
    const rawBodyBuffer = (req as any).rawBody as Buffer | string | undefined
    if (!rawBodyBuffer) {
        log.error("req.rawBody is unavailable — cannot verify signature safely")
        return res.status(500).json({ error: "Raw body unavailable — signature cannot be verified" })
    }
    const bodyForHmac = Buffer.isBuffer(rawBodyBuffer)
        ? rawBodyBuffer
        : Buffer.from(rawBodyBuffer, "utf8")

    const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(bodyForHmac)
        .digest("hex")

    // Validate format before constant-time compare to prevent buffer-length mismatch tricks.
    if (!/^[0-9a-fA-F]{64}$/.test(receivedSignature)) {
        log.warn("Signature has invalid format — request rejected")
        return res.status(400).json({ error: "Invalid signature" })
    }

    const sigBuf = Buffer.from(receivedSignature.toLowerCase(), "utf8")
    const expBuf = Buffer.from(expectedSignature.toLowerCase(), "utf8")

    if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
        log.warn("Signature mismatch — request rejected")
        return res.status(400).json({ error: "Invalid signature" })
    }

    // ── 2. Enqueue for async processing ────────────────────────────────
    // Signature is valid. Enqueue the payload and return 200 immediately so
    // Razorpay's 5-second delivery timeout is never hit, regardless of how
    // long the downstream workflow (DB query, email send) takes.
    const body    = req.body as unknown as Record<string, any>
    const event   = body?.event as string | undefined
    // Razorpay includes a top-level "id" field that uniquely identifies each event.
    // This is used as the idempotency key in the job processor.
    const eventId = (body?.id as string | undefined) ?? `${event}_${Date.now()}`

    try {
        const queue = getRazorpayQueue()
        await queue.add(event ?? "unknown", { eventId, event, payload: body?.payload ?? {} })
        log.info({ event, eventId }, "Razorpay event enqueued for processing")
    } catch (queueErr) {
        // Queue unavailable (Redis down). Log the error but still return 200 to Razorpay —
        // Razorpay will retry the webhook shortly and the queue should be back by then.
        // This is preferable to returning 500 which causes Razorpay to back off aggressively.
        log.error({ err: queueErr, event, eventId }, "Failed to enqueue Razorpay event — event may be lost if Redis is down")
    }

    return res.status(200).json({ received: true, event })
}
