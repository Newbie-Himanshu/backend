import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import logger from "../lib/logger"
import {
    COD_MAX_STRIKES,
    COD_PROVIDER_IDS,
    COD_UNLOCK_ORDERS_REQUIRED,
    isCodPickedUp,
    readCodMeta,
} from "../lib/util/cod-fraud"

const log = logger.child({ module: "cod-fraud-tracker" })

/**
 * Subscriber: Order Canceled → COD Fraud Strike Tracker
 *
 * Fires on every order cancellation. If:
 *   1. The order was paid via COD
 *   2. The courier has already picked up the parcel (status >= "shipped")
 *
 * Then a fraud strike is recorded on the customer's metadata.
 *
 * Strike 1 → warning shown at next checkout (handled by /store/cod/eligibility)
 * Strike 2 → COD permanently blocked; customer must complete 3 online orders
 *
 * Strikes are CUMULATIVE — completing an online order between strikes does NOT
 * reset the count; it only decrements cod_online_orders_needed when blocked.
 */
export default async function codFraudTrackerHandler({
    event: { data },
    container,
}: SubscriberArgs<{ id: string }>) {
    const orderId = data.id

    try {
        const orderModule = container.resolve(Modules.ORDER) as any
        const order = await orderModule.retrieveOrder(orderId, {
            relations: ["payment_collections", "payment_collections.payments"],
        })

        if (!order) {
            log.warn({ orderId }, "COD fraud tracker: order not found")
            return
        }

        // ── Guard 0: Must be customer-initiated cancellation ──────────────────
        // Admin panel cancellations do NOT set this flag, so they never trigger
        // a fraud strike — only the customer bears responsibility for their choice.
        if (order.metadata?.cancelled_by !== "customer") {
            log.debug(
                { orderId, cancelledBy: order.metadata?.cancelled_by },
                "COD fraud tracker: admin-initiated cancellation — no strike"
            )
            return
        }

        // ── Guard 1: Must be a COD order ─────────────────────────────────────
        const payments: any[] =
            order.payment_collections?.flatMap((pc: any) => pc.payments ?? []) ?? []
        const isCodOrder = payments.some((p: any) => COD_PROVIDER_IDS.has(p.provider_id))
        if (!isCodOrder) {
            log.debug({ orderId }, "COD fraud tracker: not a COD order — skipping")
            return
        }

        // ── Guard 2: Parcel must have been picked up from warehouse ───────────
        const shiprocketStatus = order.metadata?.shiprocket_status as string | undefined
        if (!isCodPickedUp(shiprocketStatus)) {
            log.debug(
                { orderId, shiprocketStatus },
                "COD fraud tracker: cancelled before pickup — no strike"
            )
            return
        }

        // ── Apply strike ──────────────────────────────────────────────────────
        const customerId = order.customer_id as string | undefined
        if (!customerId) {
            log.warn({ orderId }, "COD fraud tracker: no customer_id on order — cannot record strike")
            return
        }

        const customerModule = container.resolve(Modules.CUSTOMER) as any
        const customer = await customerModule.retrieveCustomer(customerId, {
            select: ["id", "metadata"],
        })

        const meta = readCodMeta(customer?.metadata)

        // If already blocked, nothing more to do here
        if (meta.cod_blocked) {
            log.info({ orderId, customerId }, "COD fraud tracker: customer already blocked — no-op")
            return
        }

        const newStrikeCount = meta.cod_strike_count + 1
        const willBlock = newStrikeCount >= COD_MAX_STRIKES

        const updatedMeta = {
            ...customer.metadata,
            cod_strike_count: newStrikeCount,
            cod_blocked: willBlock,
            cod_online_orders_needed: willBlock ? COD_UNLOCK_ORDERS_REQUIRED : 0,
            cod_last_strike_at: new Date().toISOString(),
        }

        await customerModule.updateCustomers(customerId, { metadata: updatedMeta })

        log.info(
            { orderId, customerId, newStrikeCount, willBlock },
            willBlock
                ? "COD fraud tracker: strike 2 — customer COD blocked"
                : "COD fraud tracker: strike 1 — warning recorded"
        )
    } catch (err) {
        // Never let fraud tracking crash the cancellation flow
        log.error({ err, orderId }, "COD fraud tracker: unexpected error — cancellation unaffected")
    }
}

export const config: SubscriberConfig = {
    event: "order.canceled",
    context: { subscriberId: "Himanshu-cod-fraud-tracker" },
}
