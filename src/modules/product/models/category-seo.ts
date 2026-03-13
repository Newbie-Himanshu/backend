import { model } from "@medusajs/framework/utils"
import ProductCategory from "./category"

const CategorySEO = model.define("category_seo", {
  id: model.id().primaryKey(),
  category_id: model.id(),
  meta_title: model.text().nullable(),
  meta_description: model.text().nullable(),
  meta_keywords: model.text().nullable(),
  og_title: model.text().nullable(),
  og_description: model.text().nullable(),
  og_image: model.text().nullable(),
  canonical_url: model.text().nullable(),
  robots: model.text().nullable(),
  schema_markup: model.text().nullable(),
  is_published: model.boolean().default(true),
  category: model.belongsTo(() => ProductCategory),
})

export default CategorySEO
