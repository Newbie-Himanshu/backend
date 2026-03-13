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
 * Workflow: Send Order Delivered Email
 *
 * Triggered by:
 *   - order.fulfillment_delivered Medusa event (admin marks as delivered)
 *   - Shiprocket webhook DELIVERED status (automatic)
 *
 * Template: order-delivered
 */
export const sendOrderDeliveredWorkflow = createWorkflow(
    "send-order-delivered",
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

        const notificationInput = transform({ orders } as any, ({ orders }: { orders: any[] }) => {
            const order = orders[0]
            if (!order?.email) return null
            return [{
                to:       order.email,
                channel:  "email" as const,
                template: "order-delivered",
                data:     { order },
            }]
        })

        const notification = when({ notificationInput }, ({ notificationInput }) =>
            notificationInput !== null
        ).then(() => sendNotificationStep(notificationInput as any))

        return new WorkflowResponse({ notification })
    }
)
