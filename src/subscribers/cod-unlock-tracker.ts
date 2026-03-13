import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import logger from "../lib/logger"
import { COD_PROVIDER_IDS, readCodMeta } from "../lib/util/cod-fraud"

const log = logger.child({ module: "cod-unlock-tracker" })

/**
 * Subscriber: Order Placed → COD Unlock Tracker
 *
 * Fires on every NEW order placement. Only acts when:
 *   1. The order is paid via an ONLINE method (not COD)
 *   2. The customer currently has cod_blocked = true
 *
 * Decrements cod_online_orders_needed by 1.
 * When it reaches 0, fully resets all COD fraud flags.
 *
 * Note: Strikes are CUMULATIVE — an online order between strikes does NOT
 * reduce the strike count. Only clearing the block resets strike_count.
 */
export default async function codUnlockTrackerHandler({
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
            log.warn({ orderId }, "COD unlock tracker: order not found")
            return
        }

        // ── Guard 1: Must be an ONLINE order (not COD) ───────────────────────
        const payments: any[] =
            order.payment_collections?.flatMap((pc: any) => pc.payments ?? []) ?? []
        const isCodOrder = payments.some((p: any) => COD_PROVIDER_IDS.has(p.provider_id))
        if (isCodOrder) {
            log.debug({ orderId }, "COD unlock tracker: COD order — skipping")
            return
        }

        const customerId = order.customer_id as string | undefined
        if (!customerId) {
            log.debug({ orderId }, "COD unlock tracker: no customer_id (guest) — skipping")
            return
        }

        const customerModule = container.resolve(Modules.CUSTOMER) as any
        const customer = await customerModule.retrieveCustomer(customerId, {
            select: ["id", "metadata"],
        })

        const meta = readCodMeta(customer?.metadata)

        // ── Guard 2: Customer must currently be blocked ───────────────────────
        if (!meta.cod_blocked) {
            log.debug(
                { orderId, customerId },
                "COD unlock tracker: customer not blocked — no-op"
            )
            return
        }

        const newOrdersNeeded = Math.max(0, meta.cod_online_orders_needed - 1)
        const fullyUnlocked = newOrdersNeeded === 0

        const updatedMeta = fullyUnlocked
            ? {
                  ...customer.metadata,
                  cod_blocked: false,
                  cod_strike_count: 0,
                  cod_online_orders_needed: 0,
                  cod_last_strike_at: customer.metadata?.cod_last_strike_at ?? null,
              }
            : {
                  ...customer.metadata,
                  cod_online_orders_needed: newOrdersNeeded,
              }

        await customerModule.updateCustomers(customerId, { metadata: updatedMeta })

        log.info(
            { orderId, customerId, newOrdersNeeded, fullyUnlocked },
            fullyUnlocked
                ? "COD unlock tracker: customer fully rehabilitated — COD re-enabled"
                : `COD unlock tracker: ${newOrdersNeeded} more online order(s) needed to unlock COD`
        )
    } catch (err) {
        // Never let this crash the order placement flow
        log.error({ err, orderId }, "COD unlock tracker: unexpected error — order placement unaffected")
    }
}

export const config: SubscriberConfig = {
    event: "order.placed",
    context: { subscriberId: "Himanshu-cod-unlock-tracker" },
}
