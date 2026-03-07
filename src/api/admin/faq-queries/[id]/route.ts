import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FAQ_QUERY_MODULE } from "../../../../modules/faq-queries"
import FaqQueryModuleService from "../../../../modules/faq-queries/service"
import { MedusaError } from "@medusajs/framework/utils"

// ── GET /admin/faq-queries/:id ─────────────────────────────────────────────

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { id } = req.params

  const faqService: FaqQueryModuleService = req.scope.resolve(FAQ_QUERY_MODULE)

  const faqQuery = await faqService.retrieveFaqQuery(id).catch(() => null)
  if (!faqQuery) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `FAQ query ${id} not found.`)
  }

  return res.json({ faq_query: faqQuery })
}

// ── PATCH /admin/faq-queries/:id ───────────────────────────────────────────
// Admin posts their answer to a customer query.
//
// Body:
//   answer   string  10-3000 chars (required)
//
// Response:
//   { faq_query: <updated record> }

export async function PATCH(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { id } = req.params
  const body = req.body as Record<string, unknown>

  const answer = typeof body.answer === "string" ? body.answer.trim() : ""

  if (answer.length < 10 || answer.length > 3000) {
    return res.status(400).json({ error: "Answer must be 10–3000 characters." })
  }

  const faqService: FaqQueryModuleService = req.scope.resolve(FAQ_QUERY_MODULE)

  const existing = await faqService.retrieveFaqQuery(id).catch(() => null)
  if (!existing) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `FAQ query ${id} not found.`)
  }

  const updated = await faqService.updateFaqQueries({
    id,
    answer,
    status:      "answered",
    answered_at: new Date(),
  })

  return res.json({ faq_query: updated })
}

// ── DELETE /admin/faq-queries/:id ──────────────────────────────────────────

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { id } = req.params

  const faqService: FaqQueryModuleService = req.scope.resolve(FAQ_QUERY_MODULE)

  const existing = await faqService.retrieveFaqQuery(id).catch(() => null)
  if (!existing) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `FAQ query ${id} not found.`)
  }

  await faqService.deleteFaqQueries([id])

  return res.json({ id, deleted: true })
}
