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
    current_city?: string   // last scan location from Shiprocket
}

/**
 * Workflow: Send Order In-Transit Email
 *
 * Triggered by: Shiprocket webhook when status = "in transit"
 * Template:     order-in-transit
 */
export const sendOrderInTransitWorkflow = createWorkflow(
    "send-order-in-transit",
    ({ id, awb, courier_name, tracking_url, current_city }: WorkflowInput) => {
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
            { orders, awb, courier_name, tracking_url, current_city },
            (input) => {
                const order = input.orders[0]
                if (!order?.email) return null
                return [{
                    to:       order.email,
                    channel:  "email" as const,
                    template: "order-in-transit",
                    data:     {
                        order,
                        awb:          input.awb,
                        courier_name: input.courier_name,
                        tracking_url: input.tracking_url,
                        current_city: input.current_city,
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
