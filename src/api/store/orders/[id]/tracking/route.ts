import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import ShiprocketService from "../../../../../services/shiprocket"

/**
 * GET /store/orders/[id]/tracking
 * Get real-time shipment tracking for an order.
 *
 * Requires: authenticated customer session.
 * The customer must own the order they are tracking.
 *
 * Params:
 *   - id: order ID
 *
 * Query:
 *   - awb: AWB/tracking number (required)
 */
export async function GET(
    req: MedusaRequest,
    res: MedusaResponse
) {
    try {
        const { id } = req.params as { id: string }
        const { awb } = req.query as { awb?: string }

        if (!awb) {
            return res.status(400).json({
                success: false,
                message: "AWB tracking number is required",
            })
        }

        // ── Ownership check ────────────────────────────────────────────────────
        // Unauthenticated callers and customers who don't own this order must not
        // receive any tracking or logistics data — AWBs appear on physical packages
        // and can be used to probe courier APIs or redirect shipments.
        const customerId = (req as any).auth_context?.actor_id as string | undefined
        if (!customerId) {
            return res.status(401).json({ success: false, message: "Authentication required" })
        }

        const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
        const { data: orders } = await query.graph({
            entity: "order",
            fields: ["id", "customer_id", "metadata"],
            filters: { id },
        })

        const order = orders?.[0] as any
        if (!order || order.customer_id !== customerId) {
            // Return 404 (not 403) to avoid confirming that the order ID exists
            return res.status(404).json({ success: false, message: "Order not found" })
        }
        // ── End ownership check ───────────────────────────────────────────────

        // ── AWB ownership check ───────────────────────────────────────────────
        // Validate the requested AWB against the one stored for THIS order.
        // Without this, an authenticated customer who owns order X could supply
        // any AWB (e.g. from a package they intercepted) and proxy a Shiprocket
        // tracking call for an unrelated shipment.
        const storedAwb = order.metadata?.shiprocket_awb as string | undefined
        if (storedAwb && storedAwb !== awb) {
            // The AWB doesn't match this order — return 404 (avoid AWB enumeration)
            return res.status(404).json({ success: false, message: "Order not found" })
        }
        // If no AWB is stored yet (fulfillment pending), allow the call through so
        // the storefront can surface "not yet shipped" gracefully.
        // ── End AWB ownership check ───────────────────────────────────────────

        const shiprocketService = req.scope.resolve<ShiprocketService>("shiprocketService")

        const tracking = await shiprocketService.trackShipment(awb)

        return res.status(200).json({
            success: true,
            order_id: id,
            awb,
            current_status: tracking.current_status,
            estimated_delivery: tracking.etd,
            delivered_date: tracking.delivered_date,
            tracking_data: tracking.tracking_data,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        console.error("[Tracking] Error:", message)
        return res.status(500).json({
            success: false,
            message: "Could not fetch tracking information. Please try again.",
        })
    }
}
