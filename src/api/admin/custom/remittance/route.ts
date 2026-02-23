import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import ShiprocketService from "../../../../services/shiprocket"

/**
 * GET /admin/custom/remittance
 *
 * Lists COD remittance batches from Shiprocket.
 * Admin-only — Medusa's admin auth middleware protects all /admin routes.
 *
 * Query params:
 *   from       YYYY-MM-DD  (default: 90 days ago)
 *   to         YYYY-MM-DD  (default: today)
 *   page       number      (default: 1)
 *   per_page   number      (default: 25, max: 100)
 *
 * Response:
 * {
 *   "entries": [
 *     {
 *       "id": 1234,
 *       "date": "2026-02-10",
 *       "transaction_id": "TXN987",
 *       "amount": 15000,
 *       "status": "REMITTED",
 *       "remittance_date": "2026-02-17",
 *       "utr": "UTR123456",
 *       "awbs": "111111,222222",
 *       "orders": "101,102"
 *     }
 *   ],
 *   "total": 42,
 *   "page": 1,
 *   "total_pages": 2,
 *   "per_page": 25
 * }
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    try {
        const { from, to, page, per_page } = req.query as Record<string, string>

        // Validate date params if provided
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/
        if (from && !dateRegex.test(from)) {
            return res.status(400).json({ error: "Invalid 'from' date format. Use YYYY-MM-DD." })
        }
        if (to && !dateRegex.test(to)) {
            return res.status(400).json({ error: "Invalid 'to' date format. Use YYYY-MM-DD." })
        }

        const parsedPage    = page     ? Math.max(1, parseInt(page, 10))          : 1
        const parsedPerPage = per_page ? Math.min(100, Math.max(1, parseInt(per_page, 10))) : 25

        if (isNaN(parsedPage) || isNaN(parsedPerPage)) {
            return res.status(400).json({ error: "page and per_page must be valid numbers" })
        }

        if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
            return res.status(503).json({
                error: "Shiprocket is not configured. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in your .env file.",
            })
        }

        const shiprocketService = req.scope.resolve<ShiprocketService>("shiprocketService")

        const result = await shiprocketService.getRemittances({
            from,
            to,
            page:     parsedPage,
            per_page: parsedPerPage,
        })

        return res.status(200).json(result)

    } catch (error) {
        // Log full detail server-side only — never expose internal messages (may contain tokens, URLs) to clients
        console.error("[Admin Remittance] List error:", (error as Error).message)
        return res.status(500).json({
            error: "Failed to fetch remittance data from Shiprocket. Check server logs for details.",
        })
    }
}
