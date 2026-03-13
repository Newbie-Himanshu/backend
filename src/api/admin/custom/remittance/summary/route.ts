import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import ShiprocketService from "../../../../../services/shiprocket"

/**
 * GET /admin/custom/remittance/summary
 *
 * Returns aggregated COD remittance health metrics for the admin dashboard.
 * Data covers the last 90 days.
 *
 * Response:
 * {
 *   "total_pending_amount": 45000,
 *   "total_remitted_last_30d": 120000,
 *   "total_remitted_last_90d": 380000,
 *   "pending_batch_count": 3,
 *   "remitted_batch_count_last_30d": 8,
 *   "last_remittance_date": "2026-02-15",
 *   "last_remittance_amount": 22000,
 *   "window_from": "2025-11-23",
 *   "window_to": "2026-02-21"
 * }
 *
 * ── Dependency Resolution ──────────────────────────────────────
 * ShiprocketService is a utility class (stateless API client) — not a Medusa
 * module. It's safe to instantiate directly and does not require DI registration.
 * This avoids unnecessary bloat in the DI container for simple utility classes.
 * If in the future ShiprocketService needs to be injected elsewhere with lifecycle
 * management, it can be converted to a Module and registered in medusa-config.ts.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    try {
        if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
            return res.status(503).json({
                error: "Shiprocket is not configured. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in your .env file.",
            })
        }

        // ✅ Direct instantiation is correct for utility services (stateless API clients)
        // ShiprocketService is NOT registered in the DI container — no need to resolve via req.scope
        const shiprocketService = new ShiprocketService()
        const summary = await shiprocketService.getRemittanceSummary()

        return res.status(200).json(summary)

    } catch (error) {
        // Log full detail server-side only — never expose internal messages (may contain tokens, URLs) to clients
        console.error("[Admin Remittance Summary] Error:", (error as Error).message)
        return res.status(500).json({
            error: "Failed to fetch remittance summary from Shiprocket. Check server logs for details.",
        })
    }
}
