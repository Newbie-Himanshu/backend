import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ProductService } from "../../../../../modules/product/services/product-service"

/**
 * GET /admin/products/[id] - Get product details (admin)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const productService: ProductService = req.scope.resolve("productService")
  const { id } = req.params

  try {
    if (!id) {
      return res.status(400).json({ error: "Product ID is required" })
    }

    const product = await productService.getProductWithCategory(id as string)

    res.json({ product })
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to fetch product",
    })
  }
}

/**
 * PUT /admin/products/[id] - Update product (admin)
 */
export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const productService: ProductService = req.scope.resolve("productService")
  const { id } = req.params
  const updates = req.body as any

  try {
    if (!id) {
      return res.status(400).json({ error: "Product ID is required" })
    }

    const updatedProduct = await productService.updateProduct(id as string, updates)

    res.json({ product: updatedProduct })
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to update product",
    })
  }
}

/**
 * DELETE /admin/products/[id] - Delete product (admin)
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const productService: ProductService = req.scope.resolve("productService")
  const { id } = req.params

  try {
    if (!id) {
      return res.status(400).json({ error: "Product ID is required" })
    }

    await productService.softDeleteProduct(id as string)

    res.json({ message: "Product deleted successfully" })
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to delete product",
    })
  }
}
