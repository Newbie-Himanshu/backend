/**
 * GST Tax Region Seed
 * Run via: yarn ts-node src/scripts/seed-gst-tax.ts
 * Or call createGstTaxRegions() from your main seed script.
 *
 * This configures Indian GST rates (5%, 12%, 18%, 28%) in the Medusa TaxModule.
 * Each rate is defined as a TaxRate on the "India" TaxRegion.
 *
 * NOTE: The Medusa Tax Module manages TaxRegions and TaxRates through its service.
 * You should call this logic inside a Medusa script or use the Admin API.
 */

import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * GST Tax Seed Script
 * 
 * Usage (from project root):
 *   yarn medusa exec src/scripts/seed-gst-tax.ts
 */
export default async function seedGstTax({ container }: ExecArgs) {
  const taxService = container.resolve(Modules.TAX)
  const logger = container.resolve("logger") as any

  logger.info("[GST Seed] Creating India tax region...")

  // Create (or upsert) the India tax region
  const [existingRegions] = await taxService.listTaxRegions({ country_code: "in" })

  let taxRegion = existingRegions

  if (!taxRegion) {
    taxRegion = await taxService.createTaxRegions({
      country_code: "in",
      default_tax_rate: {
        name: "GST 18% (Default)",
        rate: 18,
        code: "GST_18",
      },
    })
    logger.info(`[GST Seed] Created TaxRegion: ${taxRegion.id}`)
  } else {
    logger.info(`[GST Seed] TaxRegion already exists: ${taxRegion.id}`)
  }

  // Define all GST slabs (skip the default 18% already set above)
  const gstRates = [
    { name: "GST 5%",  rate: 5,  code: "GST_5"  },
    { name: "GST 12%", rate: 12, code: "GST_12" },
    { name: "GST 28%", rate: 28, code: "GST_28" },
  ]

  for (const gst of gstRates) {
    // Check if already seeded
    const [existing] = await taxService.listTaxRates({
      tax_region_id: taxRegion.id,
      code: gst.code,
    })

    if (!existing) {
      const created = await taxService.createTaxRates({
        tax_region_id: taxRegion.id,
        name: gst.name,
        rate: gst.rate,
        code: gst.code,
      })
      logger.info(`[GST Seed]  ✓ Created ${gst.name} (id: ${created.id})`)
    } else {
      logger.info(`[GST Seed]  – ${gst.name} already exists, skipping.`)
    }
  }

  logger.info("[GST Seed] Done.")
}
