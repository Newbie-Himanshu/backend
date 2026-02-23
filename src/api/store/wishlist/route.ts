import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { addToWishlistWorkflow } from "../../../workflows/wishlist"
import { WISHLIST_MODULE } from "../../../modules/wishlist"
import WishlistModuleService from "../../../modules/wishlist/service"

// GET /store/wishlist
// Returns the authenticated customer's wishlist items.
// customer_id is always taken from auth_context — never from query params.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customer_id = (req as any).auth_context?.actor_id as string

  if (!customer_id) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const wishlistService: WishlistModuleService = req.scope.resolve(WISHLIST_MODULE)

  const items = await wishlistService.listWishlistItems({ customer_id })

  res.json({ wishlist: items })
}

// POST /store/wishlist  { product_id, variant_id? }
// customer_id is taken from auth_context — not accepted from the request body.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const customer_id = (req as any).auth_context?.actor_id as string

  if (!customer_id) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const { product_id, variant_id, metadata } = req.body as {
    product_id: string
    variant_id?: string
    metadata?: Record<string, unknown>
  }

  const { result } = await addToWishlistWorkflow(req.scope).run({
    input: { customer_id, product_id, variant_id, metadata },
  })

  res.status(201).json({ wishlist_item: result })
}
