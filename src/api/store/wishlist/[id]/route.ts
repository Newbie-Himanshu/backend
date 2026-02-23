import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { removeFromWishlistWorkflow } from "../../../../workflows/wishlist"

// DELETE /store/wishlist/:id
// customer_id is taken from auth_context — never from the request body.
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const customer_id = (req as any).auth_context?.actor_id as string

  if (!customer_id) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  await removeFromWishlistWorkflow(req.scope).run({
    input: { wishlist_item_id: id, customer_id },
  })

  res.status(200).json({ deleted: true, id })
}
