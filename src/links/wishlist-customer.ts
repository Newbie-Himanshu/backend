import WishlistModule from "../modules/wishlist"
import CustomerModule from "@medusajs/medusa/customer"
import { defineLink } from "@medusajs/framework/utils"

// Each WishlistItem is owned by one Customer.
// isList: true means one Customer can have many WishlistItems.
export default defineLink(
  CustomerModule.linkable.customer,
  {
    linkable: WishlistModule.linkable.wishlistItem,
    isList: true,
    deleteCascades: true, // remove wishlist when customer is deleted
  }
)
