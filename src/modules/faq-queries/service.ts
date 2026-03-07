import { MedusaService } from "@medusajs/framework/utils"
import FaqQuery from "./models/faq-query"

/**
 * FaqQueryModuleService
 *
 * MedusaService auto-generates the full CRUD for FaqQuery:
 *   createFaqQueries(data)      — create one or many
 *   listFaqQueries(filters)     — list with optional filters
 *   listAndCountFaqQueries(...) — list + total count
 *   retrieveFaqQuery(id)        — get one by id
 *   updateFaqQueries(data)      — update one or many
 *   deleteFaqQueries(ids)       — delete one or many
 */
class FaqQueryModuleService extends MedusaService({
  FaqQuery,
}) {}

export default FaqQueryModuleService
