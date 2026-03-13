import { model } from "@medusajs/framework/utils"
import ProductCategory from "./category"

const Product = model.define("product", {
  id: model.id().primaryKey(),
  name: model.text(),
  description: model.text().nullable(),
  handle: model.text().unique().nullable(),
  price: model.bigNumber().nullable(),
  sku: model.text().nullable(),
  category_id: model.id().nullable(),
  is_active: model.boolean().default(true),
  stock_quantity: model.number().default(0),
  image_url: model.text().nullable(),
  category: model.belongsTo(() => ProductCategory, {
    foreignKey: "category_id",
  }),
})

export default Product
