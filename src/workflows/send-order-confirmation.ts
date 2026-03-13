import {
    createWorkflow,
    transform,
    when,
    WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { sendNotificationStep } from "./steps/send-notification"

type WorkflowInput = { id: string }

/**
 * Workflow: Send Order Confirmation Email
 *
 * Triggered by: order.placed event
 * Template:     order-placed
 */
export const sendOrderConfirmationWorkflow = createWorkflow(
    "send-order-confirmation",
    ({ id }: WorkflowInput) => {
        const { data: orders } = useQueryGraphStep({
            entity: "order",
            fields: [
                "id", "display_id", "email", "currency_code", "created_at",
                "total", "subtotal", "shipping_total", "tax_total", "discount_total",
                "item_total",
                "items.*",
                "shipping_address.*",
                "billing_address.*",
                "shipping_methods.*",
                "customer.*",
                "payments.*",
            ],
            filters: { id },
            options: { throwIfKeyNotFound: true },
        })

        const notificationInput = transform({ orders: orders as any }, ({ orders }: any) => {
            const order = orders[0]
            if (!order?.email) return null
            return [{
                to:       order.email,
                channel:  "email" as const,
                template: "order-placed",
                data:     { order },
            }]
        })

        const notification = when({ notificationInput }, ({ notificationInput }) =>
            notificationInput !== null
        ).then(() => sendNotificationStep(notificationInput as any))

        return new WorkflowResponse({ notification })
    }
)
