import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import Razorpay from "razorpay"

function getRazorpay() {
    const key_id = process.env.RAZORPAY_KEY_ID
    const key_secret = process.env.RAZORPAY_KEY_SECRET
    if (!key_id || !key_secret) {
        throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env")
    }
    return new Razorpay({ key_id, key_secret })
}

/**
 * GET /admin/custom/razorpay/order/:orderId
 *
 * Looks up the Razorpay payment associated with a Medusa order, then fetches
 * live status + event timeline from Razorpay's API.
 *
 * Response (not a Razorpay order):
 *   { is_razorpay: false }
 *
 * Response (Razorpay order):
 * {
 *   is_razorpay: true,
 *   payment:     RazorpayPayment,
 *   events:      RazorpayEvent[],
 *   medusa_payment_id: string   // Medusa payment row ID for reference
 * }
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

        // Gather all payments across all payment collections for this order
        const allPayments: any[] =
            order.payment_collections?.flatMap((pc: any) => pc.payments ?? []) ?? []

        // The medusa-plugin-razorpay-v2 registers under provider_id = "pp_razorpay_razorpay"
        // but can vary, so we match any provider_id that includes "razorpay".
        const rzpPayment = allPayments.find(
            (p: any) =>
                typeof p.provider_id === "string" &&
                p.provider_id.toLowerCase().includes("razorpay")
        )

        if (!rzpPayment) {
            return res.status(200).json({ is_razorpay: false })
        }

        // The plugin stores the Razorpay payment ID in payment.data under various keys.
        // Common keys across different plugin versions:
        const data = (rzpPayment.data ?? {}) as Record<string, any>
        const rzpPaymentId: string | undefined =
            data.razorpay_payment_id ??
            data.id ??
            data.paymentId ??
            data.payment_id

        if (!rzpPaymentId) {
            // Payment exists in Medusa but Razorpay ID not yet written (e.g. pending init)
            return res.status(200).json({
                is_razorpay: true,
                payment: null,
                events: [],
                medusa_payment_id: rzpPayment.id,
                raw_data: data,
                note: "Razorpay payment ID not yet available in session data",
            })
        }

        const rzp = getRazorpay()

        const [paymentResult, eventsResult] = await Promise.allSettled([
            rzp.payments.fetch(rzpPaymentId),
            (rzp.payments as any).fetchPaymentEvents(rzpPaymentId),
        ])

        const payment = paymentResult.status === "fulfilled" ? paymentResult.value : null
        const events =
            eventsResult.status === "fulfilled"
                ? ((eventsResult.value as any)?.items ?? [])
                : []

        return res.status(200).json({
            is_razorpay: true,
            payment,
            events,
            medusa_payment_id: rzpPayment.id,
            razorpay_payment_id: rzpPaymentId,
        })
    } catch (err: any) {
        res.status(500).json({ error: err?.message ?? "Failed to fetch Razorpay order payment" })
    }
}
