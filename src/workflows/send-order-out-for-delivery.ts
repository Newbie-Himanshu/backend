import {
    createWorkflow,
    transform,
    when,
    WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { sendNotificationStep } from "./steps/send-notification"

type WorkflowInput = {
    id: string              // order ID
    awb?: string
    courier_name?: string
    tracking_url?: string
}

/**
 * Workflow: Send Order Out-for-Delivery Email
 *
 * Triggered by: Shiprocket webhook when status = "out for delivery"
 * Template:     order-out-for-delivery
 */
export const sendOrderOutForDeliveryWorkflow = createWorkflow(
    "send-order-out-for-delivery",
    ({ id, awb, courier_name, tracking_url }: WorkflowInput) => {
        const { data: orders } = useQueryGraphStep({
            entity: "order",
            fields: [
                "id", "display_id", "email", "currency_code",
                "items.*",
                "shipping_address.*",
                "customer.*",
            ],
            filters: { id },
            options: { throwIfKeyNotFound: true },
        })

        const ordersAny = orders as unknown as any[]
        const notificationInput = transform(
            { orders: ordersAny, awb, courier_name, tracking_url },
            (input: any) => {
                const order = input.orders[0]
                if (!order?.email) return null
                return [{
                    to:       order.email,
                    channel:  "email" as const,
                    template: "order-out-for-delivery",
                    data:     {
                        order,
                        awb:          input.awb,
                        courier_name: input.courier_name,
                        tracking_url: input.tracking_url,
                    },
                }]
            }
        )

        const notification = when({ notificationInput }, ({ notificationInput }) =>
            notificationInput !== null
        ).then(() => sendNotificationStep(notificationInput as any))

        return new WorkflowResponse({ notification })
    }
)
