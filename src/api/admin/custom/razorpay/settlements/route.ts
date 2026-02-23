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

// ── GET /admin/custom/razorpay/settlements ─────────────────────────────────────
// Query params:
//   from    Unix timestamp (seconds) – default: 30 days ago
//   to      Unix timestamp (seconds) – default: now
//   count   max per page (max 100)   – default: 25
//   skip    offset                   – default: 0

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
        } = req.query as Record<string, string>

        const result = await (rzp.settlements as any).all({
            from: Number(from),
            to: Number(to),
            count: Math.min(Number(count), 100),
            skip: Number(skip),
        })

        const items: any[] = result.items ?? []

        // Summary
        let totalSettled = 0
        for (const s of items) {
            if (s.status === "processed") totalSettled += s.amount ?? 0
        }

        // 30-day settled total (from the current batch)
        const thirtyDayStart = now - 30 * 24 * 60 * 60
        let settled30d = 0
        for (const s of items) {
            if (s.status === "processed" && (s.created_at ?? 0) >= thirtyDayStart) {
                settled30d += s.amount ?? 0
            }
        }

        res.json({
            settlements: items,
            total_count: result.count ?? items.length,
            summary: {
                total_settled: totalSettled,
                settled_last_30d: settled30d,
            },
        })
    } catch (err: any) {
        res.status(500).json({ error: err?.message ?? "Failed to fetch settlements" })
    }
}
