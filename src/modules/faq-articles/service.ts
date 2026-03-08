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
  Database: FaqArticle,
}) {}

export default FaqArticleService
