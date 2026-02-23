import {
    createWorkflow,
    transform,
    when,
    WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { sendNotificationStep } from "./steps/send-notification"

type WorkflowInput = {
    id: string             // order ID
    awb?: string           // AWB tracking number (from Shiprocket)
    courier_name?: string  // courier name
    tracking_url?: string  // tracking URL
}

/**
 * Workflow: Send Order Shipped Email
 *
 * Triggered by: order.fulfillment_created event
 * Template:     order-shipped
 *
 * NOTE: For Shiprocket AWB/tracking info, call this workflow from the
 *       order-placed subscriber after AWB generation, or from a Shiprocket
 *       webhook subscriber, passing awb + courier_name.
 */
export const sendOrderShippedWorkflow = createWorkflow(
    "send-order-shipped",
    ({ id, awb, courier_name, tracking_url }: WorkflowInput) => {
        const { data: orders } = useQueryGraphStep({
            entity: "order",
            fields: [
                "id", "display_id", "email", "currency_code",
                "updated_at",   // used in template to compute estimated delivery date
                "items.*",
                "shipping_address.*",
                "customer.*",
            ],
            filters: { id },
            options: { throwIfKeyNotFound: true },
        })

        const notificationInput = transform(
            { orders, awb, courier_name, tracking_url },
            (input) => {
                const order = input.orders[0]
                if (!order?.email) return null
                return [{
                    to:       order.email,
                    channel:  "email" as const,
                    template: "order-shipped",
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
