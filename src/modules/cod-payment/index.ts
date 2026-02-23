import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import CodPaymentService from "./service"

export default ModuleProvider(Modules.PAYMENT, {
    services: [CodPaymentService],
})
