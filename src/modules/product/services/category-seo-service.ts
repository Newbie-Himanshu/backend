import { MedusaService } from "@medusajs/framework/utils"
import CategorySEO from "../models/category-seo"

type CategorySEODTO = {
  category_id: string
  meta_title?: string
  meta_description?: string
  meta_keywords?: string
  og_title?: string
  og_description?: string
  og_image?: string
  canonical_url?: string
  robots?: string
  schema_markup?: string
  is_published?: boolean
}

export class CategorySEOService extends MedusaService({
  CategorySEO,
}) {
  /**
   * Get or create SEO data for a category
   */
  async getOrCreateSEO(categoryId: string) {
    try {
      return await (this as any).retrieveCategorySeo(categoryId)
    } catch (error) {
      return (this as any).createCategorySeos({
        category_id: categoryId,
        meta_title: "",
        meta_description: "",
        meta_keywords: "",
        og_title: "",
        og_description: "",
        og_image: "",
        robots: "index, follow",
        is_published: true,
      })
    }
  }

  /**
   * Update SEO data for a category
   */
  async updateSEO(categoryId: string, data: Partial<CategorySEODTO>) {
    try {
      return await (this as any).updateCategorySeos([{ id: categoryId, ...data }])
    } catch (error) {
      return (this as any).createCategorySeos({
        ...data,
        category_id: categoryId,
      })
    }
  }

  /**
   * Generate default SEO data from category
   */
  async generateDefaultSEO(
    categoryId: string,
    categoryName: string,
    categoryDescription?: string
  ) {
    const seoData = {
      meta_title: `${categoryName} | Your Store`,
      meta_description: categoryDescription
        ? categoryDescription.substring(0, 160)
        : `Browse our ${categoryName} collection`,
      og_title: categoryName,
      og_description: categoryDescription || `Shop ${categoryName}`,
      robots: "index, follow",
      is_published: true,
    }

    return this.updateSEO(categoryId, seoData)
  }

  /**
   * Generate JSON-LD schema for category
   */
  generateCategorySchema(category: any): string {
    const schema = {
      "@context": "https://schema.org",
      "@type": "Category",
      name: category.name,
      description: category.description,
      url: `${process.env.STORE_URL}/categories/${category.handle}`,
      ...(category.image && {
        image: category.image,
      }),
    }

    return JSON.stringify(schema)
  }

  /**
   * Get SEO data for multiple categories
   */
  async getSEOMultiple(categoryIds: string[]) {
    return (this as any).listCategorySeos({
      category_id: categoryIds,
    } as any)
  }

  /**
   * Validate meta content length
   */
  validateMetaContent(
    title: string,
    description: string
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (title.length < 30 || title.length > 60) {
      errors.push("Meta title should be between 30-60 characters")
    }

    if (description.length < 120 || description.length > 160) {
      errors.push("Meta description should be between 120-160 characters")
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Get SEO health score for category
   */
  async getSEOHealthScore(categoryId: string): Promise<{
    score: number
    issues: string[]
  }> {
    const seo = await this.getOrCreateSEO(categoryId)
    let score = 0
    const issues: string[] = []

    if (seo.meta_title && (seo.meta_title as string).length >= 30 && (seo.meta_title as string).length <= 60) {
      score += 20
    } else {
      issues.push("Meta title needs optimization (30-60 characters)")
    }

    if (
      seo.meta_description &&
      (seo.meta_description as string).length >= 120 &&
      (seo.meta_description as string).length <= 160
    ) {
      score += 20
    } else {
      issues.push("Meta description needs optimization (120-160 characters)")
    }

    if (seo.og_title) score += 10
    else issues.push("Missing OG title")

    if (seo.og_description) score += 10
    else issues.push("Missing OG description")

    if (seo.og_image) score += 10
    else issues.push("Missing OG image")

    if (seo.schema_markup) score += 20
    else issues.push("Missing structured data (schema markup)")

    if (seo.canonical_url) score += 10
    else issues.push("Missing canonical URL")

    return { score, issues }
  }
}

export default CategorySEOService
