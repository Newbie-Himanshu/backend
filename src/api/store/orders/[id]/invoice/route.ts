import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, MedusaError } from "@medusajs/framework/utils"

// The module key exposed by @rsc-labs/medusa-documents-v2
const DOCUMENTS_MODULE = "documentsModuleService"

/**
 * GET /store/orders/:id/invoice
 *
 * Generates and streams a PDF invoice for the authenticated customer's order.
 *
 * - Customer must be logged in (enforced by authenticate middleware in middlewares.ts).
 * - Customer must own the order (ownership check done here).
 * - Uses the @rsc-labs/medusa-documents-v2 module service directly.
 *
 * Prerequisites (do once in admin):
 *   Documents → Settings → Change address  (set store address)
 *   Documents → Templates                  (choose invoice template)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const customerId: string = (req as any).auth_context?.actor_id as string

  if (!customerId) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  // ── 1. Fetch the order and verify ownership ──────────────────────────────
  const orderService = req.scope.resolve(Modules.ORDER)

  let order: any
  try {
    order = await orderService.retrieveOrder(id, {
      relations: ["items", "billing_address", "shipping_address"],
    })
  } catch {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Order ${id} not found`)
  }

  if (order.customer_id !== customerId) {
    return res.status(403).json({ error: "Forbidden: you do not own this order" })
  }

  // ── 2. Generate PDF using the RSC Labs documents module ──────────────────
  const documentsService = req.scope.resolve(DOCUMENTS_MODULE)

  let result: { invoice: any; buffer: Buffer }
  try {
    result = await (documentsService as any).generateInvoiceForOrder(order)
  } catch (err: any) {
    // Common causes: store address not set, invoice settings not configured
    return res.status(422).json({
      error: "Invoice generation failed",
      reason: err?.message ?? "Unknown error — ensure store address and invoice template are configured in the admin Documents section.",
    })
  }

  if (!result?.buffer) {
    return res.status(422).json({
      error: "Invoice generation failed",
      reason: "No PDF buffer returned. Configure store address and invoice template in admin → Documents → Settings.",
    })
  }

  // ── 3. Stream the PDF to the customer ────────────────────────────────────
  const fileName = `invoice-${result.invoice?.displayNumber ?? id}.pdf`

  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`)
  res.setHeader("Content-Length", result.buffer.length)
  res.end(result.buffer)
}
