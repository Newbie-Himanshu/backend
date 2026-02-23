import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * GET /admin/custom/cod-otp/:orderId
 *
 * Returns the COD OTP status for a given order.
 * Used by the admin order detail widget to show OTP delivery state.
 *
 * Response (is_cod = false):
 *   { is_cod: false }
 *
 * Response (is_cod = true):
 * {
 *   is_cod: true,
 *   otp_required: boolean,
 *   otp_verified: boolean,
 *   delivery_status: "verified" | "sent" | "failed" | "pending" | "not_required",
 *   phone_last4: string | null,     // last 4 digits, e.g. "3210"
 *   expires_at: string | null,      // ISO timestamp or null,
 *   attempts: number
 * }
 *
 * All /admin/** routes are automatically protected by Medusa's admin auth.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const { orderId } = req.params as { orderId: string }

    try {
        const orderModule = req.scope.resolve(Modules.ORDER) as any

        let order: any
        try {
            order = await orderModule.retrieveOrder(orderId, {
                relations: ["payment_collections", "payment_collections.payments"],
            })
        } catch {
            return res.status(404).json({ error: "Order not found" })
        }

        // Find the COD payment — provider_id can be "pp_cod_cod" or "cod"
        const payments: any[] =
            order.payment_collections?.flatMap((pc: any) => pc.payments ?? []) ?? []

        const codPayment = payments.find(
            (p: any) => p.provider_id === "pp_cod_cod" || p.provider_id === "cod"
        )

        if (!codPayment) {
            return res.status(200).json({ is_cod: false })
        }

        const d = (codPayment.data ?? {}) as Record<string, any>

        // Derive a simple delivery_status from the session data flags
        let delivery_status: string
        if (d.otp_verified) {
            delivery_status = "verified"
        } else if (d.otp_required === false) {
            delivery_status = "not_required"
        } else if (!d.otp_required) {
            delivery_status = "not_required"
        } else if (d.otp_hash) {
            // Hash is present → OTP was sent and is awaiting verification
            delivery_status = "sent"
        } else {
            delivery_status = "pending"
        }

        return res.status(200).json({
            is_cod: true,
            otp_required:    Boolean(d.otp_required),
            otp_verified:    Boolean(d.otp_verified),
            delivery_status,
            phone_last4:     d.otp_phone_last4 ?? null,
            expires_at:      d.otp_expires_at
                ? new Date(Number(d.otp_expires_at)).toISOString()
                : null,
            attempts:        Number(d.otp_attempts ?? 0),
            created_at:      codPayment.created_at ?? null,
        })
    } catch (err: any) {
        console.error(`[Admin COD OTP] GET failed for order ${orderId}:`, err.message)
        return res.status(500).json({ error: "Failed to fetch COD OTP status" })
    }
}
