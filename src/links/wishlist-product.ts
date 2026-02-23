import WishlistModule from "../modules/wishlist"
import ProductModule from "@medusajs/medusa/product"
import { defineLink } from "@medusajs/framework/utils"

// Each WishlistItem is associated with one Product.
// isList: true means one Product can be in many WishlistItems.
export default defineLink(
  ProductModule.linkable.product,
  {
    linkable: WishlistModule.linkable.wishlistItem,
    isList: true,
  }
)
