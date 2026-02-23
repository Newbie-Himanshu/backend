import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import Razorpay from "razorpay"

function getRazorpay() {
    const key_id = process.env.RAZORPAY_KEY_ID
    const key_secret = process.env.RAZORPAY_KEY_SECRET
    if (!key_id || !key_secret) {
        throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env")
    }
    return new Razorpay({ key_id, key_secret })
}

// ── POST /admin/custom/razorpay/:paymentId/capture ─────────────────────────────
// Body: { amount: number (paise), currency?: string }
// Captures an authorized Razorpay payment.

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const { paymentId } = req.params as { paymentId: string }

    try {
        const rzp = getRazorpay()

        // Fetch current payment to get amount / currency if not supplied
        const current = await rzp.payments.fetch(paymentId) as any

        if (current.status !== "authorized") {
            return res.status(400).json({
                error: `Payment ${paymentId} is not in "authorized" state (current: ${current.status})`,
            })
        }

        const body = req.body as { amount?: number; currency?: string }
        const amount: number = body.amount ?? current.amount
        const currency: string = body.currency ?? current.currency ?? "INR"

        const captured = await (rzp.payments as any).capture(paymentId, amount, currency)

        res.json({ payment: captured })
    } catch (err: any) {
        res.status(500).json({ error: err?.message ?? "Failed to capture payment" })
    }
}
