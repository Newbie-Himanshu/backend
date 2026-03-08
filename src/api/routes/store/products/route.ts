import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ProductService } from "../../modules/product/services/product-service"

/**
 * GET /store/products - Get all products with optional filtering
 * Query params:
 * - category_id: string - Filter by category
 * - page: number - Pagination page
 * - limit: number - Items per page
 * - search: string - Search products
 * - min_price: number - Min price filter
 * - max_price: number - Max price filter
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const productService: ProductService = req.scope.resolve("productService")
  const {
    category_id,
    page = "1",
    limit = "10",
    search,
    min_price,
    max_price,
  } = req.query

  try {
    let result

    if (search) {
      const products = await productService.searchProducts(search as string)
      return res.json({ products })
    }

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

    const products = await productService.getAllProducts()

    res.json({ products })
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to fetch products",
    })
  }
}

/**
 * POST /store/products - Create new product (admin only, but accessible via store)
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
