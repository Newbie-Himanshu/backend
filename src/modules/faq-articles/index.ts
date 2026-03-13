import { Module } from "@medusajs/framework/utils"
import FaqArticleService from "./service"

export const FAQ_ARTICLES_MODULE = "faq_articles"

export default Module(FAQ_ARTICLES_MODULE, {
  service: FaqArticleService,
})
