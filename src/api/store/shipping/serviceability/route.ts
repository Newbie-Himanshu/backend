import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import ShiprocketService from "../../../../services/shiprocket"

/**
 * GET /store/shipping/serviceability
 * Check if a pincode is serviceable and get available couriers + rates.
 *
 * Requires: authenticated customer session.
 * Reason: Each call proxies an authenticated Shiprocket API request. An
 * unauthenticated public endpoint would expose courier contract rate cards
 * and allow anonymous actors to exhaust the Shiprocket API quota, causing
 * checkout failures for real customers.
 *
 * Query params:
 *   - pincode: 6-digit Indian pincode (required)
 *   - weight: package weight in kg (optional, default 0.5)
 *   - cod: "true" | "false" — check COD availability (optional)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    try {
        // ── Auth gate ─────────────────────────────────────────────────────────
        const customerId = (req as any).auth_context?.actor_id as string | undefined
        if (!customerId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required to check serviceability",
            })
        }
        const { pincode, weight, cod } = req.query as {
            pincode?: string
            weight?: string
            cod?: string
        }

        if (!pincode || !/^\d{6}$/.test(pincode)) {
            return res.status(400).json({
                success: false,
                message: "A valid 6-digit pincode is required",
            })
        }

        const shiprocketEmail = process.env.SHIPROCKET_EMAIL
        const shiprocketPassword = process.env.SHIPROCKET_PASSWORD

        // If Shiprocket is not configured, fail closed — never assume serviceability
        // for unconfigured logistics. Returning serviceable:true would allow customers
        // to place orders for areas that cannot be fulfilled.
        if (
            !shiprocketEmail ||
            shiprocketEmail === "your@email.com" ||
            !shiprocketPassword ||
            shiprocketPassword === "yourpassword"
        ) {
            console.warn("[Serviceability] Shiprocket credentials not configured — returning not serviceable")
            return res.status(200).json({
                success: true,
                serviceable: false,
                message: "Delivery check unavailable at this time. Please contact support.",
                couriers: [],
                pincode,
            })
        }

        const shiprocketService = req.scope.resolve<ShiprocketService>("shiprocketService")

        const data = await shiprocketService.checkServiceability(
            pincode,
            weight ? parseFloat(weight) : 0.5,
            cod === "true"
        )

        const couriers = (data?.available_courier_companies ?? []).map((c) => ({
            name: c.courier_name,
            rate: c.rate,
            estimated_days: c.estimated_delivery_days,
            cod_available: c.cod,
        }))

        return res.status(200).json({
            success: true,
            serviceable: couriers.length > 0,
            pincode,
            couriers: couriers.slice(0, 5), // return top 5 options
            message:
                couriers.length > 0
                    ? "Delivery available to this pincode"
                    : "Sorry, delivery is not available to this pincode",
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        console.error("[Serviceability] Error:", message)
        return res.status(500).json({
            success: false,
            message: "Could not check serviceability. Please try again.",
        })
    }
}
