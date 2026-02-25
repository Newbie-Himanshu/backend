import crypto from "crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import CodPaymentService from "../../../../../../modules/cod-payment/service"
import { getRedisClient } from "../../../../../../lib/redis-client"

/**
 * POST /admin/custom/cod-otp/:orderId/resend
 *
 * Admin-triggered OTP resend for a COD order.
 * Generates a fresh OTP, sends it via MSG91, and updates the payment data.
 *
 * Response 200: { success: true, sent_at: ISO }
 * Response 400: { error: string }
 * Response 404: { error: "Order not found" }
 * Response 500: { error: string }
 *
 * All /admin/** routes are automatically protected by Medusa's admin auth.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const { orderId } = req.params as { orderId: string }

    // ── 0. Rate limit: max 1 resend per 60 seconds per order ─────────────
    // Protects against a compromised admin account or a UI bug causing an
    // SMS loop that spams the customer via MSG91.
    // Uses SET NX EX (atomic) — no TTL race condition.
    try {
        const redis = getRedisClient()
        const rlKey = `rl:otp:resend:${orderId}`
        const acquired = await redis.set(rlKey, "1", "EX", 60, "NX") as string | null
        if (acquired === null) {
            return res.status(429).json({
                error: "OTP was already resent for this order in the last 60 seconds. Please wait before trying again.",
            })
        }
    } catch {
        // Redis unavailable — allow through (rate limit is best-effort for admin routes)
    }

    try {
        const orderModule   = req.scope.resolve(Modules.ORDER) as any
        const paymentModule = req.scope.resolve(Modules.PAYMENT) as any

        // ── 1. Fetch the order with its address and payment data ─────────
        let order: any
        try {
            order = await orderModule.retrieveOrder(orderId, {
                relations: [
                    "payment_collections",
                    "payment_collections.payments",
                    "shipping_address",
                    "billing_address",
                ],
            })
        } catch {
            return res.status(404).json({ error: "Order not found" })
        }

        // ── 2. Find the COD payment ──────────────────────────────────────
        const payments: any[] =
            order.payment_collections?.flatMap((pc: any) => pc.payments ?? []) ?? []

        const codPayment = payments.find(
            (p: any) => p.provider_id === "pp_cod_cod" || p.provider_id === "cod"
        )

        if (!codPayment) {
            return res.status(400).json({ error: "This is not a COD order" })
        }

        // ── 3. Resolve the phone number ──────────────────────────────────
        // Prefer shipping address phone, fall back to billing address phone.
        const phone: string | undefined =
            order.shipping_address?.phone || order.billing_address?.phone

        if (!phone) {
            return res.status(400).json({
                error: "No phone number found on this order's shipping or billing address. Please update the address first.",
            })
        }

        // ── 4. Generate a fresh OTP ───────────────────────────────────────
        const otp  = String(crypto.randomInt(100000, 999999))
        const salt = crypto.randomBytes(16).toString("hex")
        const hash = crypto.createHmac("sha256", salt).update(otp).digest("hex")

        // Read otp_expiry_minutes from the stored session data (or default 10)
        const d = (codPayment.data ?? {}) as Record<string, any>
        const expiryMinutes: number = Number(d.otp_expiry_minutes ?? 10)
        const expiresAt = Date.now() + expiryMinutes * 60 * 1000

        // ── 5. Send via MSG91 (through the COD service) ───────────────────
        let codService: CodPaymentService
        try {
            codService = req.scope.resolve("pp_cod_cod") as CodPaymentService
        } catch {
            codService = req.scope.resolve("cod") as CodPaymentService
        }

        try {
            await codService.sendOtp(phone, otp)
        } catch (smsErr: any) {
            console.error(`[Admin COD OTP] MSG91 send failed for order ${orderId}:`, smsErr.message)
            return res.status(500).json({
                error: "Failed to send OTP via MSG91. Check server logs and verify MSG91_AUTH_KEY / MSG91_OTP_TEMPLATE_ID are set correctly.",
            })
        }

        const sentAt = new Date().toISOString()

        // ── 6. Persist the new OTP hash into the payment data ─────────────
        // Reset otp_verified so the customer must re-enter the new code.
        const updatedData = {
            ...d,
            otp_required:    true,
            otp_verified:    false,
            otp_hash:        hash,
            otp_salt:        salt,
            otp_expires_at:  expiresAt,
            otp_attempts:    0,          // reset brute-force counter
            otp_phone_last4: phone.slice(-4),
            otp_resent_at:   sentAt,
            otp_resent_by:   "admin",
        }

        try {
            // updatePayment is on the payment module; use the payment's id
            await paymentModule.updatePayment({ id: codPayment.id, data: updatedData })
        } catch (persistErr: any) {
            // OTP was sent but we failed to persist — log it, still return success
            // because the SMS is already in flight.
            console.error(
                `[Admin COD OTP] Failed to persist new OTP hash for payment ${codPayment.id}:`,
                persistErr.message
            )
        }

        console.log(`[Admin COD OTP] OTP resent for order ${orderId} to ...${phone.slice(-4)} at ${sentAt}`)

        return res.status(200).json({ success: true, sent_at: sentAt })

    } catch (err: any) {
        console.error(`[Admin COD OTP] Resend failed for order ${orderId}:`, err.message)
        return res.status(500).json({ error: "Unexpected error during OTP resend" })
    }
}
