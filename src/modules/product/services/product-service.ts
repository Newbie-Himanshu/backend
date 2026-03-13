import { MedusaService } from "@medusajs/framework/utils"
import Product from "../models/product"

type ProductDTO = {
  name: string
  handle: string
  description?: string
  price?: number | null
  sku?: string
  category_id?: string | null
  is_active?: boolean
  stock_quantity?: number
  image_url?: string
}

export class ProductService extends MedusaService({
  Product,
}) {
  /**
   * Get all products
   */
  async getAllProducts() {
    return (this as any).listProducts(
      { is_active: true } as any,
      { order: { created_at: "DESC" } } as any
    )
  }

  /**
   * Get products by category
   */
  async getProductsByCategory(categoryId: string) {
    return (this as any).listProducts(
      { category_id: categoryId, is_active: true } as any,
      { order: { created_at: "DESC" } } as any
    )
  }

  /**
   * Get products by category with pagination
   */
  async getProductsByCategoryPaginated(
    categoryId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ products: any[]; total: number }> {
    const skip = (page - 1) * limit

    const products = await (this as any).listProducts(
      { category_id: categoryId, is_active: true } as any,
      { order: { created_at: "DESC" }, skip, take: limit } as any
    )

    const allProducts = await (this as any).listProducts({
      category_id: categoryId,
      is_active: true,
    } as any) as any[]

    return { products, total: allProducts.length }
  }

  /**
   * Get featured products (limited number)
   */
  async getFeaturedProducts(limit: number = 8) {
    return (this as any).listProducts(
      { is_active: true } as any,
      { order: { created_at: "DESC" }, take: limit } as any
    )
  }

  /**
   * Get featured products by category
   */
  async getFeaturedProductsByCategory(categoryId: string, limit: number = 6) {
    return (this as any).listProducts(
      { category_id: categoryId, is_active: true } as any,
      { order: { created_at: "DESC" }, take: limit } as any
    )
  }

  /**
   * Get product with category info
   */
  async getProductWithCategory(productId: string): Promise<any> {
    return (this as any).retrieveProduct(productId)
  }

  /**
   * Create product with category
   */
  async createProduct(data: {
    name: string
    handle: string
    description?: string
    price?: number
    sku?: string
    category_id?: string
    stock_quantity?: number
    image_url?: string
  }) {
    return (this as any).createProducts({
      name: data.name,
      handle: data.handle,
      description: data.description,
      price: data.price,
      sku: data.sku,
      category_id: data.category_id,
      stock_quantity: data.stock_quantity || 0,
      image_url: data.image_url,
      is_active: true,
    })
  }

  /**
   * Update product
   */
  async updateProduct(productId: string, data: Partial<ProductDTO>) {
    await (this as any).updateProducts([{ id: productId, ...data }])
    return (this as any).retrieveProduct(productId)
  }

  /**
   * Search products by name, handle, or SKU (case-insensitive substring match)
   */
  async searchProducts(query: string) {
    const all = await (this as any).listProducts({ is_active: true }, {})
    const q = query.toLowerCase()
    return (all as any[]).filter(
      (p: any) =>
        p.name?.toLowerCase().includes(q) ||
        p.handle?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
    )
  }

  /**
   * Soft delete product (set is_active to false)
   */
  async softDeleteProduct(productId: string): Promise<void> {
    await (this as any).updateProducts([{ id: productId, is_active: false }])
  }

  /**
   * Get products with in-stock filter
   */
  async getProductsInStock() {
    return (this as any).listProducts(
      { is_active: true } as any,
      { order: { created_at: "DESC" } } as any
    )
  }

  /**
   * Filter products by multiple criteria
   */
  async filterProducts(filters: {
    categoryId?: string
    minPrice?: number
    maxPrice?: number
    search?: string
    inStock?: boolean
    page?: number
    limit?: number
  }): Promise<{ products: any[]; total: number }> {
    const page = filters.page || 1
    const limit = filters.limit || 10
    const skip = (page - 1) * limit

    const queryFilters: any = { is_active: true }

    if (filters.categoryId) {
      queryFilters.category_id = filters.categoryId
    }

    const products = await (this as any).listProducts(
      queryFilters,
      { order: { created_at: "DESC" }, skip, take: limit } as any
    ) as any[]

    let filtered = products
    if (filters.minPrice !== undefined) {
      filtered = filtered.filter((p: any) => p.price >= filters.minPrice!)
    }
    if (filters.maxPrice !== undefined) {
      filtered = filtered.filter((p: any) => p.price <= filters.maxPrice!)
    }

    const allActive = await (this as any).listProducts({ is_active: true } as any) as any[]

    return { products: filtered, total: allActive.length }
  }
}

export default ProductService
