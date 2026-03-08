import { model } from "@medusajs/framework/utils"

/**
 * FaqArticle — manages the static FAQ articles displayed in the Help Center.
 * Admins can create, edit, delete, and hide FAQs.
 *
 * Columns:
 * ──────────────────────────────────────────────────────
 *  id           UUID PK (auto-generated)
 *  title        Article title (searchable)
 *  description  Short summary for listing pages
 *  section      Category: "buying" | "shipping" | "payments" | "account" | "trust" | "miscellaneous"
 *  content      Full article content (JSON or markdown)
 *  is_visible   Toggle visibility: false = hidden from store
 *  display_order Position in the section (for sorting)
 *  total_views  Track popular articles
 *  created_at / updated_at — auto-managed by Medusa
 */
const FaqArticle = model.define("faq_article", {
  id: model.id().primaryKey(),
  title: model.text(),
  description: model.text(),
  section: model.enum([
    "buying",
    "shipping",
    "payments",
    "account",
    "trust",
    "miscellaneous",
  ]).default("buying"),
  content: model.text(), // JSON stringified FAQ steps & tips
  is_visible: model.boolean().default(true),
  display_order: model.text().default("999"), // Stored as text, parsed as number
  total_views: model.text().default("0"), // Stored as text, parsed as number
})

export default FaqArticle
