/**
 * GET /store/custom/review-eligibility?product_id=<id>
 *
 * Returns whether the authenticated customer is eligible to review a product.
 * Eligibility criteria:
 *   - Customer exists (auth_context set by authenticate middleware)
 *   - Customer has a delivered order containing this product
 *   - Customer has NOT already submitted a review for this product
 *
 * Response:
 *   { eligible: boolean, already_reviewed: boolean, customer_name: string | null }
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customer_id = (req as any).auth_context?.actor_id as string | undefined
  if (!customer_id) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  const product_id = req.query.product_id as string | undefined
  if (!product_id) {
    return res.status(400).json({ message: "product_id query param is required" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any

  try {
    // ── 1. Check purchase + delivery ──────────────────────────────────────────
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "fulfillment_status", "items.product_id"],
      filters: { customer_id },
    })

    const eligible = (orders as any[]).some(
      (order) =>
        (order.fulfillment_status === "delivered" ||
          order.fulfillment_status === "partially_delivered") &&
        (order.items as any[])?.some((item) => item.product_id === product_id)
    )

    // ── 2. Check if already reviewed ─────────────────────────────────────────
    // The plugin exposes GET /store/product-reviews?product_id=X&customer_id=Y
    // We call it internally via the HTTP layer to stay decoupled.
    let already_reviewed = false
    try {
      const { data: reviews } = await query.graph({
        entity: "product_review",
        fields: ["id"],
        filters: { product_id, customer_id },
      })
      already_reviewed = Array.isArray(reviews) && reviews.length > 0
    } catch {
      // Plugin may not expose the entity via query.graph — fall back to false
      already_reviewed = false
    }

    // ── 3. Fetch customer name ────────────────────────────────────────────────
    let customer_name: string | null = null
    if (eligible) {
      const { data: customers } = await query.graph({
        entity: "customer",
        fields: ["first_name", "last_name"],
        filters: { id: customer_id },
      })
      const c = (customers as any[])?.[0]
      const name = [c?.first_name, c?.last_name].filter(Boolean).join(" ")
      customer_name = name || null
    }

    return res.json({ eligible, already_reviewed, customer_name })
  } catch (err) {
    console.error("[review-eligibility] Error:", (err as Error).message)
    return res.status(500).json({ message: "Failed to check review eligibility." })
  }
}
