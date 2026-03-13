import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import ShiprocketService from "../services/shiprocket"

/**
 * Subscriber: Order Canceled → Cancel Shiprocket Shipment (BUG-010 fix)
 *
 * When an order is cancelled in Medusa, this subscriber notifies Shiprocket
 * so the courier does not attempt pickup or delivery.
 *
 * Flow:
 *   order.canceled
 *   → Retrieve fulfillments from Medusa order
 *   → Extract AWB codes from fulfillment.data.awb_code
 *   → Call ShiprocketService.cancelShipment(awbCodes)
 *
 * Safe to run if:
 *   - Shiprocket credentials are absent (skips with warning)
 *   - Fulfillment has no AWB yet (nothing to cancel — logs info)
 *   - Shiprocket API fails (logs error, does not throw — order is already cancelled)
 */
export default async function orderCancelledShiprocketHandler({
    event: { data },
    container,
}: SubscriberArgs<{ id: string }>) {
    const orderId = data.id

    // Guard: only run if Shiprocket credentials are configured
    if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
        console.log(`[Shiprocket Cancel] Credentials not set — skipping cancellation for order ${orderId}`)
        return
    }

    try {
        // Retrieve order with fulfillments
        const orderModuleService = container.resolve(Modules.ORDER) as any
        const order = await orderModuleService.retrieveOrder(orderId, {
            relations: ["fulfillments"],
        })

        if (!order?.fulfillments?.length) {
            console.log(`[Shiprocket Cancel] Order ${orderId} has no fulfillments — nothing to cancel in Shiprocket`)
            return
        }

        // Collect all AWB codes from fulfillment.data
        const awbCodes: string[] = order.fulfillments
            .map((f: any) => f.data?.awb_code as string | undefined)
            .filter((awb: string | undefined): awb is string => typeof awb === "string" && awb.length > 0)

        if (!awbCodes.length) {
            console.log(`[Shiprocket Cancel] Order ${orderId} fulfillments have no AWB codes — Shiprocket not yet notified, no cancellation needed`)
            return
        }

        const shiprocket = new ShiprocketService()
        await shiprocket.cancelShipment(awbCodes)

        console.log(`[Shiprocket Cancel] Successfully cancelled AWBs ${awbCodes.join(", ")} for order ${orderId}`)
    } catch (error) {
        // Log but do not throw — the Medusa order is already cancelled.
        // Admin should manually cancel in Shiprocket dashboard if this fails.
        console.error(
            `[Shiprocket Cancel] Failed to cancel Shiprocket shipment for order ${orderId}:`,
            (error as Error).message
        )
        console.error(
            `[Shiprocket Cancel] ⚠️  Manual cancellation may be required in Shiprocket Dashboard for order ${orderId}`
        )
    }
}

export const config: SubscriberConfig = {
    event: "order.canceled",
    context: { subscriberId: "Himanshu-order-cancelled-shiprocket" },
}
