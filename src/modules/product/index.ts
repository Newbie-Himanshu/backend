import { Module } from "@medusajs/framework/utils"
import { CategoryService } from "./services/category-service"

export const PRODUCT_MODULE_KEY = "product"

export default Module(PRODUCT_MODULE_KEY, {
  service: CategoryService,
})
