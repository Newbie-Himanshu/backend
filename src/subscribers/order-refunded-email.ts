import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendOrderRefundedWorkflow } from "../workflows/send-order-refunded"

/**
 * Subscriber: Return Created → Send Refund Initiated Email
 *
 * Triggered when a customer return is created. The `data.id` is the
 * Return ID — the workflow will look up the associated order.
 *
 * Includes COD-specific refund instructions (bank transfer timeline).
 *
 * Template: order-refunded
 */
export default async function orderRefundedEmailHandler({
    event: { data },
    container,
}: SubscriberArgs<{ id: string }>) {
    const resendConfigured = !!(process.env.RESEND_API_KEY)
    if (!resendConfigured) {
        console.log("[Email] RESEND_API_KEY not set — skipping refund email")
        return
    }

    try {
        await sendOrderRefundedWorkflow(container).run({ input: { id: data.id } })
        console.log(`[Email] Refund initiated email sent for return ${data.id}`)
    } catch (error) {
        console.error(`[Email] Failed to send refund email for return ${data.id}:`, (error as Error).message)
    }
}

export const config: SubscriberConfig = {
    event: "return.created",
    context: { subscriberId: "vridhira-order-refunded-email" },
}
