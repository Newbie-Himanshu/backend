import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type RegionModuleService = {
    listRegions: (filters: Record<string, unknown>) => Promise<Array<{ id: string }>>
    createRegions: (data: Record<string, unknown>) => Promise<{ id: string }>
}

type FulfillmentModuleService = {
    listShippingProfiles: (filters: Record<string, unknown>) => Promise<Array<{ id: string }>>
    createShippingProfiles: (data: Record<string, unknown>) => Promise<{ id: string }>
    listFulfillmentSets: (filters: Record<string, unknown>) => Promise<Array<{ id: string }>>
    createFulfillmentSets: (data: Record<string, unknown>) => Promise<{ id: string }>
}

/**
 * India Region Seed Script for Vridhira Marketplace
 *
 * Sets up:
 * - India region with INR currency
 * - Default shipping profile and fulfillment set
 *
 * Run with:
 *   yarn medusa exec ./src/scripts/seed-india.ts
 *
 * After running:
 * 1. Login to admin at http://localhost:9000/app
 * 2. Go to Settings > Regions > India
 * 3. Enable Razorpay and COD payment providers
 * 4. Add shipping options (Standard ₹49, Express ₹99, Free above ₹499)
 */
export default async function seedIndia({ container }: ExecArgs) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

    logger.info("🇮🇳 Starting India region seed...")

    try {
        // ── Step 1: Create India region ──
        const regionService = container.resolve<RegionModuleService>("regionModuleService")

        const existingRegions = await regionService
            .listRegions({ name: "India" })
            .catch(() => [] as Array<{ id: string }>)

        let indiaRegion: { id: string }

        if (existingRegions.length > 0) {
            indiaRegion = existingRegions[0]
            logger.info(`✅ India region already exists (id: ${indiaRegion.id})`)
        } else {
            indiaRegion = await regionService.createRegions({
                name: "India",
                currency_code: "inr",
                countries: ["in"],
                automatic_taxes: true,
            })
            logger.info(`✅ Created India region (id: ${indiaRegion.id})`)
        }

        // ── Step 2: Create default shipping profile ──
        const fulfillmentService =
            container.resolve<FulfillmentModuleService>("fulfillmentModuleService")

        const existingProfiles = await fulfillmentService
            .listShippingProfiles({ type: "default" })
            .catch(() => [] as Array<{ id: string }>)

        let profile: { id: string }
        if (existingProfiles.length > 0) {
            profile = existingProfiles[0]
        } else {
            profile = await fulfillmentService.createShippingProfiles({
                name: "Default",
                type: "default",
            })
        }

        logger.info(`✅ Shipping profile ready (id: ${profile.id})`)

        // ── Step 3: Create fulfillment set (shipping type) ──
        const existingFulfillmentSets = await fulfillmentService
            .listFulfillmentSets({ name: "vridhira-fulfillment" })
            .catch(() => [] as Array<{ id: string }>)

        let fulfillmentSet: { id: string }
        if (existingFulfillmentSets.length > 0) {
            fulfillmentSet = existingFulfillmentSets[0]
        } else {
            fulfillmentSet = await fulfillmentService.createFulfillmentSets({
                name: "vridhira-fulfillment",
                type: "shipping",
            })
        }

        logger.info(`✅ Fulfillment set ready (id: ${fulfillmentSet.id})`)

        logger.info("✅ India region setup complete!")
        logger.info("")
        logger.info("📌 NEXT STEPS (manual in Admin Dashboard):")
        logger.info("   1. Visit http://localhost:9000/app")
        logger.info("   2. Settings → Regions → India")
        logger.info("   3. Enable payment providers: Razorpay + Cash on Delivery")
        logger.info("   4. Settings → Shipping → Add shipping options with INR prices:")
        logger.info("      - Standard Shipping: ₹49")
        logger.info("      - Express Shipping: ₹99")
        logger.info("      - Free Shipping (on orders above ₹499)")
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`❌ Seed failed: ${message}`, error instanceof Error ? error : new Error(message))
        logger.info("Tip: Make sure migrations have run first: yarn medusa db:migrate")
        throw error
    }
}
