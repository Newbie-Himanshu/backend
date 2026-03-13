import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FAQ_ARTICLES_MODULE } from "../../../modules/faq-articles"
import FaqArticleService from "../../../modules/faq-articles/service"

/**
 * GET /admin/faq-articles
 *
 * Admin-only (protected by Medusa's /admin/** session guard).
 *
 * Query params:
 *   section     Filter by section (buying, shipping, payments, account, community, trust)
 *   visibility  "visible" | "hidden" | "all" (default: "all")
 *   limit       number (default: 50, max: 200)
 *   offset      number (default: 0)
 *
 * Response:
 *   { articles: FaqArticle[], count: number, offset: number, limit: number }
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const qs = req.query as Record<string, string>

  const section = qs.section || undefined
  const visibility = qs.visibility || "all"
  const limit = Math.min(Math.max(parseInt(qs.limit ?? "50", 10) || 50, 1), 200)
  const offset = Math.max(parseInt(qs.offset ?? "0", 10) || 0, 0)

  const faqService: FaqArticleService = req.scope.resolve(FAQ_ARTICLES_MODULE)

  const filters: any = {}
  if (section) filters.section = section
  if (visibility === "visible") filters.is_visible = true
  if (visibility === "hidden") filters.is_visible = false

  try {
    const articles = await faqService.listArticles(filters, {
      take: limit,
      skip: offset,
    })

    // Get total count
    const allArticles = await faqService.listArticles(filters, {
      take: 10000,
      skip: 0,
    })
    const count = allArticles.length

    return res.json({
      articles,
      count,
      offset,
      limit,
    })
  } catch (error) {
    console.error("Error fetching FAQ articles:", error)
    return res
      .status(500)
      .json({ error: "Failed to fetch FAQ articles" })
  }
}

/**
 * POST /admin/faq-articles
 *
 * Create a new FAQ article
 *
 * Request body:
 *   {
 *     title: string,
 *     description: string,
 *     section: "buying" | "shipping" | "payments" | "account" | "community" | "trust",
 *     content: string (JSON or markdown),
 *     is_visible?: boolean,
 *     display_order?: number
 *   }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const faqService: FaqArticleService = req.scope.resolve(FAQ_ARTICLES_MODULE)

  const { title, description, section, content, is_visible, display_order } =
    req.body as any

  if (!title || !description || !section || !content) {
    return res
      .status(400)
      .json({
        error: "Missing required fields: title, description, section, content",
      })
  }

  try {
    const article = await faqService.createArticle({
      title,
      description,
      section,
      content,
      is_visible: is_visible ?? true,
      display_order: display_order ?? 999,
    })

    return res.status(201).json({ article })
  } catch (error) {
    console.error("Error creating FAQ article:", error)
    return res
      .status(500)
      .json({ error: "Failed to create FAQ article" })
  }
}
