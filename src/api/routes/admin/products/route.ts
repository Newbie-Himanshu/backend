import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ProductService } from "../../../../modules/product/services/product-service"

/**
 * GET /admin/products - Get all products (admin only)
 * Query params:
 * - category_id: string
 * - page: number
 * - limit: number
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const productService: ProductService = req.scope.resolve("productService")
  const { category_id, page = "1", limit = "20" } = req.query

  try {
    if (category_id) {
      const { products, total } = await productService.getProductsByCategoryPaginated(
        category_id as string,
        parseInt(page as string),
        parseInt(limit as string)
      )

      return res.json({
        products,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string)),
        },
      })
    }

    const products = await productService.list()

    res.json({ products })
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to fetch products",
    })
  }
}

/**
 * POST /admin/products - Create product (admin only)
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const productService: ProductService = req.scope.resolve("productService")
  const { name, handle, description, price, sku, category_id, stock_quantity, image_url } =
    req.body

  try {
    if (!name || !handle) {
      return res.status(400).json({ error: "Name and handle are required" })
    }

    const product = await productService.createProduct({
      name,
      handle,
      description,
      price,
      sku,
      category_id,
      stock_quantity,
      image_url,
    })

    res.status(201).json({ product })
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to create product",
    })
  }
}
