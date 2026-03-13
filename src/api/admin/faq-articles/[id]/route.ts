import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FAQ_ARTICLES_MODULE } from "../../../../modules/faq-articles"
import FaqArticleService from "../../../../modules/faq-articles/service"

/**
 * GET /admin/faq-articles/[id]
 *
 * Get a single FAQ article by ID
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const faqService: FaqArticleService = req.scope.resolve(FAQ_ARTICLES_MODULE)

  try {
    const article = await faqService.getArticle(id)
    if (!article) {
      return res.status(404).json({ error: "FAQ article not found" })
    }
    return res.json({ article })
  } catch (error) {
    console.error("Error fetching FAQ article:", error)
    return res
      .status(500)
      .json({ error: "Failed to fetch FAQ article" })
  }
}

/**
 * PATCH /admin/faq-articles/[id]
 *
 * Update a FAQ article
 *
 * Request body:
 *   {
 *     title?: string,
 *     description?: string,
 *     section?: string,
 *     content?: string,
 *     is_visible?: boolean,
 *     display_order?: number
 *   }
 */
export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const faqService: FaqArticleService = req.scope.resolve(FAQ_ARTICLES_MODULE)

  try {
    const article = await faqService.updateArticle(id, req.body as any)
    return res.json({ article })
  } catch (error) {
    console.error("Error updating FAQ article:", error)
    return res
      .status(500)
      .json({ error: "Failed to update FAQ article" })
  }
}

/**
 * DELETE /admin/faq-articles/[id]
 *
 * Delete a FAQ article
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const faqService: FaqArticleService = req.scope.resolve(FAQ_ARTICLES_MODULE)

  try {
    await faqService.deleteArticle(id)
    return res.json({ message: "FAQ article deleted successfully" })
  } catch (error) {
    console.error("Error deleting FAQ article:", error)
    return res
      .status(500)
      .json({ error: "Failed to delete FAQ article" })
  }
}
