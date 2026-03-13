import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendOrderDeliveredWorkflow } from "../workflows/send-order-delivered"

/**
 * Subscriber: Fulfillment Delivered → Send Delivered Email
 *
 * Triggered when an admin marks an order's fulfillment as "Delivered"
 * in the Medusa admin panel (order.fulfillment_delivered event).
 *
 * For Shiprocket-driven deliveries the Shiprocket webhook already sends this
 * email AND updates order.metadata.shiprocket_email_delivered_at BEFORE it
 * calls markOrderFulfillmentAsDeliveredWorkflow (which fires this event).
 * The idempotency check below ensures we never double-send.
 *
 * Template: order-delivered
 * Event:    order.fulfillment_delivered
 */
export default async function orderDeliveredEmailHandler({
    event: { data },
    container,
}: SubscriberArgs<{ id: string }>) {
    const resendConfigured = !!(process.env.RESEND_API_KEY)
    if (!resendConfigured) {
        console.log("[Email] RESEND_API_KEY not set — skipping delivered email")
        return
    }

    // ── Idempotency: skip if Shiprocket webhook already sent this email ───────
    // The Shiprocket webhook sets metadata.shiprocket_email_delivered_at BEFORE
    // it calls markOrderFulfillmentAsDeliveredWorkflow, ensuring the flag is
    // present here by the time this subscriber runs.
    try {
        const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
        const { data: orders } = await query.graph({
            entity: "order",
            fields: ["id", "metadata"],
            filters: { id: data.id },
        })
        const order = orders?.[0] as any
        if (order?.metadata?.shiprocket_email_delivered_at) {
            console.log(`[Email] Delivered email already sent by Shiprocket webhook for order ${data.id} — skipping duplicate`)
            return
        }
    } catch (checkErr) {
        // Non-fatal: if the check fails, proceed so a manual delivery still sends an email
        console.warn(`[Email] Metadata idempotency check failed for order ${data.id}:`, (checkErr as Error).message)
    }

    try {
        await sendOrderDeliveredWorkflow(container).run({
            input: { id: data.id },
        })
        console.log(`[Email] Delivered notification sent for order ${data.id}`)
    } catch (error) {
        console.error(
            `[Email] Failed to send delivered email for order ${data.id}:`,
            (error as Error).message
        )
    }
}

export const config: SubscriberConfig = {
    event: "order.fulfillment_delivered",
    context: { subscriberId: "Himanshu-order-delivered-email" },
}
