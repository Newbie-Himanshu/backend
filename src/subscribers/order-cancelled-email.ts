import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendOrderCancelledWorkflow } from "../workflows/send-order-cancelled"

/**
 * Subscriber: Order Canceled → Send Cancellation Email
 *
 * Triggered when an order is cancelled (by customer or admin).
 * Includes refund information for prepaid orders.
 *
 * Template: order-cancelled
 */
export default async function orderCancelledEmailHandler({
    event: { data },
    container,
}: SubscriberArgs<{ id: string }>) {
    const resendConfigured = !!(process.env.RESEND_API_KEY)
    if (!resendConfigured) {
        console.log("[Email] RESEND_API_KEY not set — skipping cancellation email")
        return
    }

    try {
        await sendOrderCancelledWorkflow(container).run({ input: { id: data.id } })
        console.log(`[Email] Cancellation email sent for order ${data.id}`)
    } catch (error) {
        console.error(`[Email] Failed to send cancellation email for ${data.id}:`, (error as Error).message)
    }
}

export const config: SubscriberConfig = {
    event: "order.canceled",
}
