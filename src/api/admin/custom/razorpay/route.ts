import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import Razorpay from "razorpay"

// ── helpers ────────────────────────────────────────────────────────────────────

function getRazorpay() {
    const key_id = process.env.RAZORPAY_KEY_ID
    const key_secret = process.env.RAZORPAY_KEY_SECRET

    if (!key_id || !key_secret) {
        throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env")
    }

    return new Razorpay({ key_id, key_secret })
}

// ── GET /admin/custom/razorpay ─────────────────────────────────────────────────
// Query params:
//   from        Unix timestamp (seconds) – default: 30 days ago
//   to          Unix timestamp (seconds) – default: now
//   count       max results per page (max 100)  – default: 25
//   skip        offset for pagination            – default: 0
//   q           search substring (payment ID, email, contact, notes)

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    try {
        const rzp = getRazorpay()

        const now = Math.floor(Date.now() / 1000)
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60

        const {
            from = String(thirtyDaysAgo),
            to = String(now),
            count = "25",
            skip = "0",
            q = "",
        } = req.query as Record<string, string>

        const options: Record<string, any> = {
            from: Number(from),
            to: Number(to),
            count: Math.min(Number(count), 100),
            skip: Number(skip),
        }

        const result = await (rzp.payments as any).all(options)

        // Client-side filter by q (payment ID, email, contact, notes)
        let payments: any[] = result.items ?? []
        if (q) {
            const lower = q.toLowerCase()
            payments = payments.filter((p: any) => {
                return (
                    p.id?.toLowerCase().includes(lower) ||
                    p.email?.toLowerCase().includes(lower) ||
                    p.contact?.toLowerCase().includes(lower) ||
                    p.description?.toLowerCase().includes(lower) ||
                    String(p.order_id ?? "").toLowerCase().includes(lower)
                )
            })
        }

        // Payment method breakdown from this batch
        const methodBreakdown: Record<string, number> = {}
        for (const p of payments) {
            const method: string = p.method ?? "other"
            methodBreakdown[method] = (methodBreakdown[method] ?? 0) + 1
        }

        // Quick summary stats from this batch
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const todayTs = Math.floor(todayStart.getTime() / 1000)

        let capturedToday = 0
        let refundedToday = 0
        let pendingCaptures = 0

        for (const p of result.items ?? []) {
            const createdAt = p.created_at ?? 0
            if (p.status === "captured" && createdAt >= todayTs) capturedToday += p.amount ?? 0
            if (p.status === "refunded" && createdAt >= todayTs) refundedToday += p.amount_refunded ?? 0
            if (p.status === "authorized") pendingCaptures += 1
        }

        res.json({
            payments,
            total_count: result.count ?? payments.length,
            method_breakdown: methodBreakdown,
            summary: {
                captured_today: capturedToday,
                refunded_today: refundedToday,
                pending_captures: pendingCaptures,
            },
        })
    } catch (err: any) {
        res.status(500).json({ error: err?.message ?? "Failed to fetch Razorpay payments" })
    }
}
