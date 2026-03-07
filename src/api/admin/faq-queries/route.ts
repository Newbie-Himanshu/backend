import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FAQ_QUERY_MODULE } from "../../../modules/faq-queries"
import FaqQueryModuleService from "../../../modules/faq-queries/service"

/**
 * GET /admin/faq-queries
 *
 * Admin-only (protected by Medusa's /admin/** session guard).
 *
 * Query params:
 *   status   "pending" | "answered" | "all"  (default: "all")
 *   limit    number  (default: 50, max: 200)
 *   offset   number  (default: 0)
 *
 * Response:
 *   { faq_queries: FaqQuery[], count: number, offset: number, limit: number }
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const qs = req.query as Record<string, string>

  const statusFilter = ["pending", "answered"].includes(qs.status) ? qs.status : undefined
  const limit  = Math.min(Math.max(parseInt(qs.limit  ?? "50",  10) || 50,  1), 200)
  const offset = Math.max(parseInt(qs.offset ?? "0",   10) || 0,  0)

  const faqService: FaqQueryModuleService = req.scope.resolve(FAQ_QUERY_MODULE)

  const filters = statusFilter ? { status: statusFilter } : {}

  const [faq_queries, count] = await faqService.listAndCountFaqQueries(
    filters,
    { skip: offset, take: limit, order: { created_at: "DESC" } } as any,
  )

  return res.json({ faq_queries, count, offset, limit })
}
