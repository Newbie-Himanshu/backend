import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendOrderConfirmationWorkflow } from "../workflows/send-order-confirmation"

/**
 * Subscriber: Order Placed → Send Confirmation Email
 *
 * Runs after order.placed event. Complements the Shiprocket subscriber
 * (order-placed.ts) — both can listen to the same event in Medusa v2.
 *
 * Template: order-placed
 */
export default async function orderPlacedEmailHandler({
    event: { data },
    container,
}: SubscriberArgs<{ id: string }>) {
    const resendConfigured = !!(process.env.RESEND_API_KEY)
    if (!resendConfigured) {
        console.log("[Email] RESEND_API_KEY not set — skipping order confirmation email")
        return
    }

    try {
        await sendOrderConfirmationWorkflow(container).run({ input: { id: data.id } })
        console.log(`[Email] Order confirmation sent for order ${data.id}`)
    } catch (error) {
        // Fire-and-forget: do NOT fail the order
        console.error(`[Email] Failed to send order confirmation for ${data.id}:`, (error as Error).message)
    }
}

export const config: SubscriberConfig = {
    event: "order.placed",
}
