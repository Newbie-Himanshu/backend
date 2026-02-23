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
 * Workflow: Send Order Cancelled Email
 *
 * Triggered by: order.canceled event
 * Template:     order-cancelled
 *
 * Includes refund notice for prepaid orders.
 */
export const sendOrderCancelledWorkflow = createWorkflow(
    "send-order-cancelled",
    ({ id }: WorkflowInput) => {
        const { data: orders } = useQueryGraphStep({
            entity: "order",
            fields: [
                "id", "display_id", "email", "currency_code",
                "total", "subtotal",
                "items.*",
                "shipping_address.*",
                "customer.*",
                "payments.*",
            ],
            filters: { id },
            options: { throwIfKeyNotFound: true },
        })

        const notificationInput = transform({ orders }, ({ orders }) => {
            const order = orders[0]
            if (!order?.email) return null
            return [{
                to:       order.email,
                channel:  "email" as const,
                template: "order-cancelled",
                data:     { order },
            }]
        })

        const notification = when({ notificationInput }, ({ notificationInput }) =>
            notificationInput !== null
        ).then(() => sendNotificationStep(notificationInput as any))

        return new WorkflowResponse({ notification })
    }
)
