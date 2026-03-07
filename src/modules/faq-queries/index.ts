import FaqQueryModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const FAQ_QUERY_MODULE = "faq_query"

export default Module(FAQ_QUERY_MODULE, {
  service: FaqQueryModuleService,
})
