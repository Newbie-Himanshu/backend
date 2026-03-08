import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ProductService } from "../../../../modules/product/services/product-service"

/**
 * GET /store/products/[id] - Get product details
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const productService: ProductService = req.scope.resolve("productService")
  const { id } = req.params

  try {
    if (!id) {
      return res.status(400).json({ error: "Product ID is required" })
    }

    const product = await productService.retrieve(id as string)

    if (!product || !product.is_active) {
      return res.status(404).json({ error: "Product not found" })
    }

    res.json({ product })
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to fetch product",
    })
  }
}

/**
 * PUT /store/products/[id] - Update product
 */
export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const productService: ProductService = req.scope.resolve("productService")
  const { id } = req.params
  const updates = req.body

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
 * DELETE /store/products/[id] - Delete product (soft delete)
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
