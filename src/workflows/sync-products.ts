import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { syncProductsStep, SyncProductsStepInput } from "./steps/sync-products"
import { deleteProductsFromAlgoliaStep } from "./steps/delete-products-from-algolia"

type SyncProductsWorkflowInput = {
  filters?: Record<string, unknown>
  limit?: number
  offset?: number
}

export const syncProductsWorkflow = createWorkflow(
  "sync-products",
  ({ filters, limit, offset }: SyncProductsWorkflowInput) => {
    // Step 1: Fetch products from Medusa (with optional pagination / filter)
    const { data: products, metadata } = useQueryGraphStep({
      entity: "product",
      fields: [
        "id",
        "title",
        "description",
        "handle",
        "thumbnail",
        "status",
        "categories.id",
        "categories.name",
        "categories.handle",
        "tags.id",
        "tags.value",
      ],
      pagination: {
        take: limit,
        skip: offset,
      },
      filters,
    })

    // Step 2: Separate published (index) from unpublished (remove)
    const { publishedProducts, unpublishedProductsToDelete } = transform(
      { products },
      (data: { products: { id: string; status: string; [key: string]: unknown }[] }) => {
        const publishedProducts: SyncProductsStepInput["products"] = []
        const unpublishedProductsToDelete: string[] = []

        data.products.forEach((product: any) => {
          if (product.status === "published") {
            const { status, ...rest } = product
            publishedProducts.push(rest as SyncProductsStepInput["products"][0])
          } else {
            unpublishedProductsToDelete.push(product.id)
          }
        })

        return { publishedProducts, unpublishedProductsToDelete }
      }
    )

    // Step 3: Upsert published products into Algolia
    syncProductsStep({ products: publishedProducts })

    // Step 4: Remove unpublished products from Algolia
    deleteProductsFromAlgoliaStep({ ids: unpublishedProductsToDelete })

    return new WorkflowResponse({ products, metadata } as any)
  }
)
