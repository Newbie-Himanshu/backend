import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FAQ_QUERY_MODULE } from "../../../modules/faq-queries"
import FaqQueryModuleService from "../../../modules/faq-queries/service"

// ── Validation helpers ─────────────────────────────────────────────────────
// Basic email RFC 5321 check — no DNS lookup, just structural sanity
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,10}$/

function isString(v: unknown): v is string {
  return typeof v === "string"
}

/**
 * POST /store/faq-queries
 *
 * Public endpoint — no authentication required.
 * A customer submits a question. The admin answers it from the Admin Panel.
 *
 * Rate-limited (5 req / hour per IP) via middlewares.ts.
 *
 * Body:
 *   customer_name   string  2-100 chars
 *   customer_email  string  valid email ≤ 254 chars
 *   subject         string  3-150 chars
 *   question        string  10-2000 chars
 *
 * Response 201:
 *   { faq_query: { id, customer_name, customer_email, subject, question, status, created_at } }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as Record<string, unknown>

  const name    = isString(body.customer_name)  ? body.customer_name.trim()  : ""
  const email   = isString(body.customer_email) ? body.customer_email.trim() : ""
  const subject = isString(body.subject)        ? body.subject.trim()        : ""
  const question = isString(body.question)      ? body.question.trim()       : ""

  if (name.length < 2 || name.length > 100) {
    return res.status(400).json({ error: "Name must be 2–100 characters." })
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: "A valid email address is required." })
  }
  if (subject.length < 3 || subject.length > 150) {
    return res.status(400).json({ error: "Subject must be 3–150 characters." })
  }
  if (question.length < 10 || question.length > 2000) {
    return res.status(400).json({ error: "Question must be 10–2000 characters." })
  }

  const faqService: FaqQueryModuleService = req.scope.resolve(FAQ_QUERY_MODULE)

  const faqQuery = await faqService.createFaqQueries({
    customer_name:  name,
    customer_email: email.toLowerCase(),
    subject,
    question,
    status: "pending",
  })

  // Never return PII fields beyond what the customer already knows
  return res.status(201).json({
    faq_query: {
      id:             faqQuery.id,
      subject:        faqQuery.subject,
      status:         faqQuery.status,
      created_at:     (faqQuery as any).created_at,
    },
  })
}
