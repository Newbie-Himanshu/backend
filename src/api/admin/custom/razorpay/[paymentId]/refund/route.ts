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

// ── POST /admin/custom/razorpay/:paymentId/refund ──────────────────────────────
// Body:
//   amount?  number  (paise) – omit for full refund
//   speed?   "normal" | "optimum"   – default: "normal"
//   notes?   Record<string, string>
//
// Issues a full or partial refund on a captured payment.

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const { paymentId } = req.params as { paymentId: string }

    try {
        const rzp = getRazorpay()

        const current = await rzp.payments.fetch(paymentId) as any

        if (current.status !== "captured") {
            return res.status(400).json({
                error: `Payment ${paymentId} is not in "captured" state (current: ${current.status})`,
            })
        }

        const body = req.body as {
            amount?: number
            speed?: "normal" | "optimum"
            notes?: Record<string, string>
        }

        const refundOptions: Record<string, any> = {}
        if (body.amount !== undefined) refundOptions.amount = body.amount
        refundOptions.speed = body.speed ?? "normal"
        if (body.notes) refundOptions.notes = body.notes

        const refund = await (rzp.payments as any).refund(paymentId, refundOptions)

        res.json({ refund })
    } catch (err: any) {
        res.status(500).json({ error: err?.message ?? "Failed to issue refund" })
    }
}
