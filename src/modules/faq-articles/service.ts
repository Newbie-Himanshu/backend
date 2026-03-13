import { MedusaService } from "@medusajs/framework/utils"
import FaqArticle from "./models/faq-article"

export type FaqArticleData = {
  title: string
  description: string
  section: "buying" | "shipping" | "payments" | "account" | "trust" | "miscellaneous"
  content: string
  is_visible?: boolean
  display_order?: number | string
}

class FaqArticleService extends MedusaService({
  FaqArticle,
}) {
  async listArticles(filters?: Record<string, unknown>, options?: Record<string, unknown>) {
    return this.listFaqArticles(filters as any, options as any)
  }

  async getArticle(id: string, options?: Record<string, unknown>) {
    return this.retrieveFaqArticle(id, options as any)
  }

  async createArticle(data: FaqArticleData) {
    return this.createFaqArticles({
      title: data.title,
      description: data.description,
      section: data.section,
      content: data.content,
      is_visible: data.is_visible ?? true,
      display_order: Number(data.display_order ?? 0),
    } as any)
  }

  async updateArticle(id: string, data: Partial<FaqArticleData>) {
    const updateData: Record<string, unknown> = { id }
    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.section !== undefined) updateData.section = data.section
    if (data.content !== undefined) updateData.content = data.content
    if (data.is_visible !== undefined) updateData.is_visible = data.is_visible
    if (data.display_order !== undefined) updateData.display_order = Number(data.display_order)
    return this.updateFaqArticles(updateData as any)
  }

  async deleteArticle(id: string) {
    return this.deleteFaqArticles([id] as any)
  }
}

export default FaqArticleService
