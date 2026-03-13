import { model } from "@medusajs/framework/utils"
import ProductCategory from "./category"

const CategoryMedia = model.define("category_media", {
  id: model.id().primaryKey(),
  category_id: model.id(),
  media_type: model.enum(["image", "icon", "banner", "thumbnail"]),
  url: model.text(),
  alt_text: model.text().nullable(),
  mime_type: model.text().nullable(),
  file_size: model.number().nullable(),
  width: model.number().nullable(),
  height: model.number().nullable(),
  is_primary: model.boolean().default(false),
  sort_order: model.number().default(0),
  category: model.belongsTo(() => ProductCategory),
})

export default CategoryMedia
