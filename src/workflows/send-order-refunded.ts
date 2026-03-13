import {
    createWorkflow,
    transform,
    when,
    WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { fetchOrderAndReturnStep } from "./steps/fetch-order-and-return"
import { sendNotificationStep } from "./steps/send-notification"

type WorkflowInput = {
    /**
     * For return-based refunds (return.created event): pass the Return ID.
     * For direct refunds (Razorpay refund.processed webhook, no formal return): pass the Order ID and set isDirectRefund=true.
     */
    id: string
    isDirectRefund?: boolean
    directRefundAmount?: number  // raw paise amount from Razorpay webhook
}

/**
 * Workflow: Send Order Refunded Email
 *
 * Triggered by:
 *  - return.created subscriber  (id = Return ID, isDirectRefund defaults to false)
 *  - Razorpay refund.processed webhook (id = Order ID, isDirectRefund = true)
 *
 * Template: order-refunded
 *
 * Dual-path:
 * 1. Normal path: fetches Return → gets order_id → fetches Order
 * 2. Direct path: `id` is already the Order ID
 */
export const sendOrderRefundedWorkflow = createWorkflow(
    "send-order-refunded",
    ({ id, isDirectRefund, directRefundAmount }: WorkflowInput) => {
        // Single step handles both Return and Order queries to avoid duplicate
        // step-name registration error (useQueryGraphStep has a fixed step ID).
        const { order, returnRecord } = fetchOrderAndReturnStep({ id, isDirectRefund })

        const notificationInput = transform({ order, returnRecord, isDirectRefund, directRefundAmount }, (input: any) => {
            if (!input.order?.email) return null

            // Resolve refund amount: prefer return record, fall back to Razorpay amount
            const refund_amount = input.isDirectRefund
                ? (input.directRefundAmount ?? input.order.total)
                : (input.returnRecord as any)?.refund_amount

            return [{
                to:       input.order.email,
                channel:  "email" as const,
                template: "order-refunded",
                data:     { order: input.order, refund_amount },
            }]
        })

        const notification = when({ notificationInput }, ({ notificationInput }) =>
            notificationInput !== null
        ).then(() => sendNotificationStep(notificationInput as any))

        return new WorkflowResponse({ notification })
    }
)
