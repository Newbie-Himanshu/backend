import { model } from "@medusajs/framework/utils"

const ProductCategory = model.define("product_category", {
  id: model.id().primaryKey(),
  name: model.text(),
  description: model.text().nullable(),
  handle: model.text().unique().nullable(),
  parent_category_id: model.id().nullable(),
  level: model.number().default(0),
  sort_order: model.number().nullable(),
  path: model.text().nullable(),
  parent_category: model.belongsTo(() => ProductCategory, {
    foreignKey: "parent_category_id",
  }),
  children: model.hasMany(() => ProductCategory, {
    foreignKey: "parent_category_id",
  }),
})

export default ProductCategory
