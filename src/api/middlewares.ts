import { defineMiddlewares, authenticate } from "@medusajs/framework/http"

/**
 * API Route Middlewares
 *
 * Enforces authentication on custom store routes that require a logged-in customer.
 * Per Medusa v2 docs, the authenticate middleware must be explicitly applied to
 * custom routes — it is NOT automatically inherited from built-in route protection.
 *
 * Medusa automatically protects:
 *   /admin/**  - admin user auth (session + bearer + api-key)
 *
 * We explicitly protect:
 *   /store/shipping/serviceability  - customer session required
 *   /store/orders/:id/tracking      - customer session required (+ ownership check in handler)
 *   /store/cod/verify-otp           - customer session required
 *
 * No middleware needed for:
 *   /store/auth/**   - pre-authentication flows (send-verification, verify-email)
 *   /hooks/**        - token-based webhook auth handled in each handler
 *   /store/custom    - public health-check placeholder
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
  ],
})
