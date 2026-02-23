import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { WISHLIST_MODULE } from "../modules/wishlist"
import WishlistModuleService from "../modules/wishlist/service"
import { Modules } from "@medusajs/framework/utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

type AddToWishlistInput = {
  customer_id: string
  product_id: string
  variant_id?: string
  metadata?: Record<string, unknown>
}

type RemoveFromWishlistInput = {
  wishlist_item_id: string
  customer_id: string
}

// ─── Steps ───────────────────────────────────────────────────────────────────

const createWishlistItemStep = createStep(
  "create-wishlist-item-step",
  async (input: AddToWishlistInput, { container }) => {
    const wishlistService: WishlistModuleService =
      container.resolve(WISHLIST_MODULE)

    const item = await wishlistService.createWishlistItems({
      customer_id: input.customer_id,
      product_id: input.product_id,
      variant_id: input.variant_id ?? null,
      metadata: input.metadata ?? null,
    })

    return new StepResponse(item, item.id)
  },
  // Compensation: delete the item if the workflow fails after this step
  async (itemId: string, { container }) => {
    const wishlistService: WishlistModuleService =
      container.resolve(WISHLIST_MODULE)
    await wishlistService.deleteWishlistItems(itemId)
  }
)

const linkWishlistItemToCustomerStep = createStep(
  "link-wishlist-item-to-customer-step",
  async (
    { customer_id, wishlist_item_id }: { customer_id: string; wishlist_item_id: string },
    { container }
  ) => {
    const link = container.resolve(ContainerRegistrationKeys.LINK)

    await link.create({
      [Modules.CUSTOMER]: { customer_id },
      [WISHLIST_MODULE]: { wishlist_item_id },
    })

    return new StepResponse({ customer_id, wishlist_item_id })
  },
  async (
    { customer_id, wishlist_item_id }: { customer_id: string; wishlist_item_id: string },
    { container }
  ) => {
    const link = container.resolve(ContainerRegistrationKeys.LINK)
    await link.dismiss({
      [Modules.CUSTOMER]: { customer_id },
      [WISHLIST_MODULE]: { wishlist_item_id },
    })
  }
)

const linkWishlistItemToProductStep = createStep(
  "link-wishlist-item-to-product-step",
  async (
    { product_id, wishlist_item_id }: { product_id: string; wishlist_item_id: string },
    { container }
  ) => {
    const link = container.resolve(ContainerRegistrationKeys.LINK)

    await link.create({
      [Modules.PRODUCT]: { product_id },
      [WISHLIST_MODULE]: { wishlist_item_id },
    })

    return new StepResponse({ product_id, wishlist_item_id })
  },
  async (
    { product_id, wishlist_item_id }: { product_id: string; wishlist_item_id: string },
    { container }
  ) => {
    const link = container.resolve(ContainerRegistrationKeys.LINK)
    await link.dismiss({
      [Modules.PRODUCT]: { product_id },
      [WISHLIST_MODULE]: { wishlist_item_id },
    })
  }
)

// ─── Add to Wishlist Workflow ─────────────────────────────────────────────────

export const addToWishlistWorkflow = createWorkflow(
  "add-to-wishlist",
  function (input: AddToWishlistInput) {
    const item = createWishlistItemStep(input)

    linkWishlistItemToCustomerStep({
      customer_id: input.customer_id,
      // @ts-ignore - WorkflowData type
      wishlist_item_id: item.id,
    })

    linkWishlistItemToProductStep({
      product_id: input.product_id,
      // @ts-ignore - WorkflowData type
      wishlist_item_id: item.id,
    })

    return new WorkflowResponse(item)
  }
)

// ─── Remove from Wishlist Step ───────────────────────────────────────────────

const deleteWishlistItemStep = createStep(
  "delete-wishlist-item-step",
  async (input: RemoveFromWishlistInput, { container }) => {
    const wishlistService: WishlistModuleService =
      container.resolve(WISHLIST_MODULE)

    // Fetch the item first so we can restore it in compensation
    const [item] = await wishlistService.listWishlistItems({
      id: input.wishlist_item_id,
      customer_id: input.customer_id,
    })

    if (!item) {
      throw new Error(
        `WishlistItem ${input.wishlist_item_id} not found for customer ${input.customer_id}`
      )
    }

    await wishlistService.deleteWishlistItems(input.wishlist_item_id)

    return new StepResponse(item, item)
  },
  // Compensation: restore the item
  async (item: any, { container }) => {
    const wishlistService: WishlistModuleService =
      container.resolve(WISHLIST_MODULE)
    await wishlistService.createWishlistItems(item)
  }
)

export const removeFromWishlistWorkflow = createWorkflow(
  "remove-from-wishlist",
  function (input: RemoveFromWishlistInput) {
    const deleted = deleteWishlistItemStep(input)
    return new WorkflowResponse(deleted)
  }
)
