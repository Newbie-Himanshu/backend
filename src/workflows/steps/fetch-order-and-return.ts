import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type Input = {
    id: string
    isDirectRefund?: boolean
}

type Output = {
    order: Record<string, any> | null
    returnRecord: Record<string, any> | null
    orderId: string
}

/**
 * Single step that performs both Return and Order queries for the refund workflow.
 * Replaces two separate useQueryGraphStep calls (which would conflict — same step
 * name cannot appear twice in one workflow).
 */
export const fetchOrderAndReturnStep = createStep(
    "fetch-order-and-return-step",
    async ({ id, isDirectRefund }: Input, { container }): Promise<StepResponse<Output>> => {
        const query = container.resolve(ContainerRegistrationKeys.QUERY)

        let returnRecord: Record<string, any> | null = null
        let orderId = id

        if (!isDirectRefund) {
            const { data: returns } = await query.graph({
                entity: "return",
                fields: ["id", "order_id", "refund_amount"],
                filters: { id },
            }).catch(() => ({ data: [] }))

            if (returns?.[0]) {
                returnRecord = returns[0] as Record<string, any>
                orderId = (returnRecord as any).order_id ?? id
            }
        }

        const { data: orders } = await query.graph({
            entity: "order",
            fields: [
                "id", "display_id", "email", "currency_code",
                "total",
                "items.*",
                "shipping_address.*",
                "customer.*",
            ],
            filters: { id: orderId },
        }).catch(() => ({ data: [] }))

        const order = (orders?.[0] as Record<string, any>) ?? null

        return new StepResponse({ order, returnRecord, orderId })
    }
)
