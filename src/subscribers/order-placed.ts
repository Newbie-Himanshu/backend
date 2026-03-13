import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { createOrderFulfillmentWorkflow } from "@medusajs/core-flows"

type OrderPlacedPayload = {
    id: string
}

// ── Subscriber ────────────────────────────────────────────────────────────────
/**
 * Order Placed Subscriber — Auto-creates Shiprocket shipment on order placement
 *
 * Flow:
 *   order.placed
 *   → createOrderFulfillmentWorkflow  (Medusa-native: creates Fulfillment record,
 *                                      updates order.fulfillment_status, calls provider)
 *   → ShiprocketFulfillmentProvider.createFulfillment
 *       → createOrder → generateAWB → schedulePickup
 *   → sendOrderShippedWorkflow  (email with real AWB + courier name)
 *
 * Dimensions are read per-product from product.metadata:
 *   shiprocket_length, shiprocket_breadth, shiprocket_height, shiprocket_weight
 * Falls back to 15×12×10 cm / 0.5 kg when metadata is absent.
 *
 * Required env vars:
 *   SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD — Shiprocket account credentials
 *   MEDUSA_STOCK_LOCATION_ID              — ID from Admin › Settings › Locations
 *
 * NOTE: Fire-and-forget. Fulfillment errors are logged but do NOT fail the
 *       order — the order is already confirmed at this point.
 */
export default async function orderPlacedHandler({
    event: { data },
    container,
}: SubscriberArgs<OrderPlacedPayload>) {
    const orderId = data.id
    console.log(`[OrderPlaced] Handling order: ${orderId}`)

    try {
        // 1. Guard: Shiprocket credentials must be present
        if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
            console.warn(`[OrderPlaced] Shiprocket credentials missing — skipping auto-fulfillment for order ${orderId}`)
            return
        }

        // 2. Guard: Stock location is required by createOrderFulfillmentWorkflow
        const locationId = process.env.MEDUSA_STOCK_LOCATION_ID
        if (!locationId) {
            console.warn(`[OrderPlaced] MEDUSA_STOCK_LOCATION_ID not set — skipping auto-fulfillment for order ${orderId}`)
            return
        }

        // 3. Fetch order items via the v2 Order Module (Modules enum, not string key)
        const orderModuleService = container.resolve(Modules.ORDER) as any
        const order = await orderModuleService.retrieveOrder(orderId, {
            relations: ["items", "items.variant"],
        })

        if (!order?.items?.length) {
            console.warn(`[OrderPlaced] Order ${orderId} has no items — skipping fulfillment`)
            return
        }

        // 4. Build item list — only physically shippable items
        const itemsToFulfill = order.items
            .filter((i: any) => i.requires_shipping !== false)
            .map((i: any) => ({ id: i.id, quantity: i.quantity }))

        if (!itemsToFulfill.length) {
            console.log(`[OrderPlaced] Order ${orderId} has no shippable items — skipping fulfillment`)
            return
        }

        // 5. Create fulfillment via the Medusa-native workflow.
        //    createOrderFulfillmentWorkflow is the ONLY correct v2 approach — it:
        //      a) Creates the Fulfillment record linked to the Order in the database
        //      b) Updates order.fulfillment_status to "fulfilled" / "partially_fulfilled"
        //      c) Invokes ShiprocketFulfillmentProvider.createFulfillment with a proper
        //         FulfillmentOrderDTO (includes shipping_address, email, payments, etc.)
        //
        //    Passing no_notification: true because we send our own branded email below.
        const { result: fulfillments } = await createOrderFulfillmentWorkflow(container).run({
            input: {
                order_id: orderId,
                location_id: locationId,
                items: itemsToFulfill,
                no_notification: true,
            },
        })

        const fulfillment = fulfillments?.[0]
        if (!fulfillment) {
            console.warn(`[OrderPlaced] Workflow returned no fulfillment for order ${orderId}`)
            return
        }

        console.log(`[OrderPlaced] Fulfillment created: ${fulfillment.id}`)
        console.log(`[OrderPlaced] Provider data:`, JSON.stringify(fulfillment.data, null, 2))

        // NOTE: No "Shipped" email is sent here.
        // The Shiprocket webhook (POST /hooks/shiprocket) fires when the courier
        // physically collects the package and sends the Shipped email at that point.
        // Sending it here (at order placement, before pickup) would result in:
        //   1. A premature email — the courier hasn't collected the package yet.
        //   2. A duplicate — the webhook's idempotency guard (metadata.shiprocket_email_shipped_at)
        //      is NOT set by this subscriber, so both emails would be delivered.
        // The Order Confirmation email (order-placed-email.ts subscriber) already notifies
        // the customer that their order has been accepted.
        const awb = fulfillment.data?.awb_code as string | undefined
        const courierName = fulfillment.data?.courier_name as string | undefined
        if (awb) {
            console.log(`[OrderPlaced] AWB assigned: ${awb} | Courier: ${courierName ?? "TBD"} | Shipped email will be sent by Shiprocket webhook`)
        } else {
            console.warn(`[OrderPlaced] No AWB in fulfillment.data for order ${orderId} — AWB may be assigned asynchronously`)
        }

    } catch (error) {
        const errorMsg = (error as Error).message
        console.error(`[OrderPlaced] Auto-fulfillment FAILED for order ${orderId}: ${errorMsg}`)

        // BUG-008 FIX: Mark the order with a metadata flag so admin panel can surface
        // unfulfilled orders. Also send a structured alert email if ADMIN_EMAIL is set.
        try {
            // Resolve order module — already available in container
            const orderModuleService = container.resolve(Modules.ORDER) as any
            await orderModuleService.updateOrders([{
                id: orderId,
                metadata: {
                    fulfillment_failed: true,
                    fulfillment_failed_at: new Date().toISOString(),
                    fulfillment_error: errorMsg.substring(0, 500),
                },
            }])
            console.warn(`[OrderPlaced] Marked order ${orderId} as fulfillment_failed in metadata`)
        } catch (metaErr) {
            console.error(`[OrderPlaced] Could not update order metadata for ${orderId}:`, (metaErr as Error).message)
        }

        // Send admin alert email via Resend if configured
        const adminEmail = process.env.ADMIN_ALERT_EMAIL
        const resendKey  = process.env.RESEND_API_KEY
        if (adminEmail && resendKey) {
            try {
                await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${resendKey}`,
                    },
                    body: JSON.stringify({
                        from: process.env.RESEND_FROM_EMAIL ?? "no-reply@Himanshu.in",
                        to: adminEmail,
                        subject: `⚠️ Fulfillment Failed — Order #${orderId}`,
                        html: `<p><strong>Shiprocket auto-fulfillment failed</strong> for order <code>${orderId}</code>.</p><p>Error: <code>${errorMsg}</code></p><p>Please create the shipment manually in the Shiprocket dashboard.</p>`,
                    }),
                })
                console.log(`[OrderPlaced] Admin alert sent to ${adminEmail} for order ${orderId}`)
            } catch (alertErr) {
                console.error(`[OrderPlaced] Could not send admin alert email:`, (alertErr as Error).message)
            }
        }
        // We do NOT throw — this prevents blocking other subscribers on the event bus
    }
}

export const config: SubscriberConfig = {
    event: "order.placed",
    context: { subscriberId: "Himanshu-order-placed-fulfillment" },
}
