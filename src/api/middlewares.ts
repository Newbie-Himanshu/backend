import { defineMiddlewares, authenticate } from "@medusajs/framework/http"
import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// ── Verified-purchase middleware ───────────────────────────────────────────────
// Applied to POST /store/product-reviews (the @lambdacurry/medusa-product-reviews
// plugin endpoint). Enforces two rules:
//   1. Customer must be authenticated.
//   2. Customer must have a delivered order that contains the product reviewed.
// Also injects the customer's real account name as display_name so it cannot be
// spoofed from the frontend.
async function requireVerifiedPurchase(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const customer_id = (req as any).auth_context?.actor_id as string | undefined
  if (!customer_id) {
    return res.status(401).json({ message: "You must be logged in to write a review." })
  }

  const body = req.body as Record<string, unknown>
  const product_id = body?.product_id as string | undefined
  if (!product_id) return next()

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any

    // Check that customer has a delivered order containing this product
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "fulfillment_status", "items.product_id"],
      filters: { customer_id },
    })

    const hasDelivered = (orders as any[]).some(
      (order) =>
        (order.fulfillment_status === "delivered" ||
          order.fulfillment_status === "partially_delivered") &&
        (order.items as any[])?.some((item) => item.product_id === product_id)
    )

    if (!hasDelivered) {
      return res.status(403).json({
        message: "Only verified buyers with a delivered order can review this product.",
      })
    }

    // Inject real customer name — cannot be spoofed from frontend
    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["first_name", "last_name"],
      filters: { id: customer_id },
    })
    const c = (customers as any[])?.[0]
    const fullName = [c?.first_name, c?.last_name].filter(Boolean).join(" ")
    if (fullName) body.display_name = fullName

    return next()
  } catch (err) {
    console.error("[ReviewMiddleware] Error:", (err as Error).message)
    return res.status(500).json({ message: "Failed to verify purchase eligibility." })
  }
}

/**
 * API Route Middlewares
 *
 * Enforces authentication on custom store routes that require a logged-in customer.
 * Per Medusa v2 docs, the authenticate middleware must be explicitly applied to
 * custom routes — it is NOT automatically inherited from built-in route protection.
 *
 * @see https://docs.medusajs.com/learn/fundamentals/api-routes/protected-routes
 */
export default defineMiddlewares({
  routes: [
    // ── Serviceability check ─────────────────────────────────────────────────
    // Requires a logged-in customer to prevent anonymous actors from probing
    // courier rate cards and exhausting the Shiprocket API quota.
    {
      matcher: "/store/shipping/serviceability*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },

    // ── COD OTP verification ─────────────────────────────────────────────────
    // Bind OTP verification to an authenticated customer session.
    // The handler also validates by payment_session_id, providing defense-in-depth.
    {
      matcher: "/store/cod/verify-otp*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },

    // ── Order tracking ───────────────────────────────────────────────────────
    // Requires a logged-in customer. The handler also verifies order ownership
    // (customer_id on the order must match auth_context.actor_id).
    {
      matcher: "/store/orders/*/tracking*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },

    // ── Customer invoice download ────────────────────────────────────────────
    // Customer must be logged in. Handler also verifies order ownership.
    // GET /store/orders/:id/invoice  → streams PDF using @rsc-labs/medusa-documents-v2
    {
      matcher: "/store/orders/*/invoice*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },

    // ── Wishlist ─────────────────────────────────────────────────────────────
    // All wishlist operations (list, add, remove) require a logged-in customer.
    // The customer_id is derived from auth_context in each handler — never
    // accepted as a query param — to prevent cross-customer data access.
    {
      matcher: "/store/wishlist*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },

    // ── Product Reviews ───────────────────────────────────────────────────────
    // POST /store/product-reviews (plugin endpoint): authenticate + verify delivery.
    // The requireVerifiedPurchase middleware rejects unauthenticated requests,
    // checks the customer has a delivered order with the product, and injects
    // the customer's real name so it cannot be spoofed from the frontend.
    {
      matcher: "/store/product-reviews",
      method: ["POST"],
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        requireVerifiedPurchase,
      ],
    },

    // ── Review eligibility + pending review checks ────────────────────────────
    // Auth-required so customer_id is available from auth_context in handlers.
    {
      matcher: "/store/custom/review-eligibility*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/custom/pending-reviews*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
  ],
})
