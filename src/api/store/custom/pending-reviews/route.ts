/**
 * GET /store/custom/pending-reviews
 *
 * Returns a list of products the authenticated customer has purchased + received
 * (fulfillment_status = delivered/partially_delivered) but has NOT yet reviewed.
 *
 * Used by the <ReviewPrompt> component to show toast notifications.
 *
 * Response:
 *   { pending_reviews: Array<{ product_id, product_title, product_thumbnail }> }
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customer_id = (req as any).auth_context?.actor_id as string | undefined
  if (!customer_id) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any

  try {
    // ── 1. Fetch delivered orders for this customer ───────────────────────────
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "fulfillment_status",
        "items.product_id",
        "items.title",
        "items.thumbnail",
      ],
      filters: { customer_id },
    })

    // Collect unique products from delivered orders
    const deliveredProducts = new Map<
      string,
      { product_id: string; product_title: string; product_thumbnail: string | null }
    >()

    for (const order of orders as any[]) {
      if (
        order.fulfillment_status !== "delivered" &&
        order.fulfillment_status !== "partially_delivered"
      ) {
        continue
      }
      for (const item of (order.items as any[]) ?? []) {
        if (item.product_id && !deliveredProducts.has(item.product_id)) {
          deliveredProducts.set(item.product_id, {
            product_id: item.product_id,
            product_title: item.title ?? "Product",
            product_thumbnail: item.thumbnail ?? null,
          })
        }
      }
    }

    if (deliveredProducts.size === 0) {
      return res.json({ pending_reviews: [] })
    }

    // ── 2. Filter out already-reviewed products ───────────────────────────────
    let reviewedProductIds = new Set<string>()
    try {
      const { data: reviews } = await query.graph({
        entity: "product_review",
        fields: ["product_id"],
        filters: { customer_id },
      })
      for (const r of (reviews as any[]) ?? []) {
        if (r.product_id) reviewedProductIds.add(r.product_id)
      }
    } catch {
      // Plugin entity may not be available via query.graph — return all delivered
      reviewedProductIds = new Set()
    }

    const pending_reviews = [...deliveredProducts.values()].filter(
      (p) => !reviewedProductIds.has(p.product_id)
    )

    return res.json({ pending_reviews })
  } catch (err) {
    console.error("[pending-reviews] Error:", (err as Error).message)
    return res.status(500).json({ message: "Failed to fetch pending reviews." })
  }
}
