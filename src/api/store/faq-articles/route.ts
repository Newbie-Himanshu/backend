import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FAQ_ARTICLES_MODULE } from "../../../modules/faq-articles"
import FaqArticleService from "../../../modules/faq-articles/service"

/**
 * GET /store/faq-articles
 *
 * Public store endpoint - fetch visible FAQ articles
 *
 * Query params:
 *   section   Filter by section (buying, shipping, payments, account, community, trust)
 *   limit     number (default: 50, max: 200)
 *   offset    number (default: 0)
 *
 * Response:
 *   { articles: FaqArticle[], count: number, offset: number, limit: number }
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const qs = req.query as Record<string, string>

  const section = qs.section || undefined
  const limit = Math.min(Math.max(parseInt(qs.limit ?? "50", 10) || 50, 1), 200)
  const offset = Math.max(parseInt(qs.offset ?? "0", 10) || 0, 0)

  const faqService: FaqArticleService = req.scope.resolve(FAQ_ARTICLES_MODULE)

  try {
    const filters = {
      is_visible: true, // Only visible articles in store
      ...(section && { section }),
    }

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
