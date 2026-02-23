import React from "react"
import {
    AbstractNotificationProviderService,
    MedusaError,
} from "@medusajs/framework/utils"
import {
    Logger,
    ProviderSendNotificationDTO,
    ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types"
import { Resend } from "resend"
import type { CreateEmailOptions } from "resend"
import { orderPlacedEmail } from "./emails/order-placed"
import { orderShippedEmail } from "./emails/order-shipped"
import { orderInTransitEmail } from "./emails/order-in-transit"
import { orderOutForDeliveryEmail } from "./emails/order-out-for-delivery"
import { orderCancelledEmail } from "./emails/order-cancelled"
import { orderRefundedEmail } from "./emails/order-refunded"
import { orderDeliveredEmail } from "./emails/order-delivered"
import { passwordResetEmail } from "./emails/password-reset"
import { emailVerificationEmail } from "./emails/email-verification"

type ResendOptions = {
    api_key: string
    from: string
}

type InjectedDependencies = {
    logger: Logger
}

export enum Templates {
    ORDER_PLACED          = "order-placed",
    ORDER_SHIPPED         = "order-shipped",
    ORDER_IN_TRANSIT      = "order-in-transit",
    ORDER_OUT_FOR_DELIVERY = "order-out-for-delivery",
    ORDER_CANCELLED       = "order-cancelled",
    ORDER_REFUNDED        = "order-refunded",
    ORDER_DELIVERED       = "order-delivered",
    PASSWORD_RESET        = "password-reset",
    EMAIL_VERIFICATION    = "email-verification",
}

const templateMap: Record<string, (props: any) => React.ReactNode> = {
    [Templates.ORDER_PLACED]:           orderPlacedEmail,
    [Templates.ORDER_SHIPPED]:          orderShippedEmail,
    [Templates.ORDER_IN_TRANSIT]:       orderInTransitEmail,
    [Templates.ORDER_OUT_FOR_DELIVERY]: orderOutForDeliveryEmail,
    [Templates.ORDER_CANCELLED]:        orderCancelledEmail,
    [Templates.ORDER_REFUNDED]:         orderRefundedEmail,
    [Templates.ORDER_DELIVERED]:        orderDeliveredEmail,
    [Templates.PASSWORD_RESET]:         passwordResetEmail,
    [Templates.EMAIL_VERIFICATION]:     emailVerificationEmail,
}

const subjectMap: Record<string, string> = {
    [Templates.ORDER_PLACED]:           "✅ Order Confirmed – Vridhira Marketplace",
    [Templates.ORDER_SHIPPED]:          "🚚 Your Order Has Shipped – Vridhira Marketplace",
    [Templates.ORDER_IN_TRANSIT]:       "🛤️ Your Order Is In Transit – Vridhira Marketplace",
    [Templates.ORDER_OUT_FOR_DELIVERY]: "🛵 Out for Delivery Today! – Vridhira Marketplace",
    [Templates.ORDER_CANCELLED]:        "Order Cancelled – Vridhira Marketplace",
    [Templates.ORDER_REFUNDED]:         "💰 Refund Initiated – Vridhira Marketplace",
    [Templates.ORDER_DELIVERED]:        "📦 Order Delivered! – Vridhira Marketplace",
    [Templates.PASSWORD_RESET]:         "🔐 Reset your Vridhira Marketplace password",
    [Templates.EMAIL_VERIFICATION]:     "✉️ Verify your email – Vridhira Marketplace",
}

/**
 * Resend Notification Module Provider for Vridhira Marketplace
 *
 * Handles transactional emails for all customer-facing events:
 *  - order-placed    → Order confirmation
 *  - order-shipped   → Shipping notification
 *  - order-delivered → Delivery confirmation
 *  - order-cancelled → Cancellation notice
 *  - order-refunded  → Refund initiation notice
 *
 * Docs: https://docs.medusajs.com/resources/integrations/guides/resend
 */
class ResendNotificationProviderService extends AbstractNotificationProviderService {
    static identifier = "notification-resend"

    private resendClient: Resend
    private options: ResendOptions
    private logger: Logger

    constructor({ logger }: InjectedDependencies, options: ResendOptions) {
        super()
        this.resendClient = new Resend(options.api_key)
        this.options = options
        this.logger = logger
    }

    static validateOptions(options: Record<string, any>) {
        if (!options.api_key) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "Option `api_key` is required in the Resend provider's options."
            )
        }
        if (!options.from) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "Option `from` is required in the Resend provider's options."
            )
        }
    }

    async send(
        notification: ProviderSendNotificationDTO
    ): Promise<ProviderSendNotificationResultsDTO> {
        const templateFn = templateMap[notification.template]

        if (!templateFn) {
            this.logger.error(
                `[Resend] No template found for "${notification.template}". ` +
                `Valid: ${Object.values(Templates).join(", ")}`
            )
            return {}
        }

        const emailOptions: CreateEmailOptions = {
            from:    this.options.from,
            to:      [notification.to],
            subject: subjectMap[notification.template] ?? "Update from Vridhira Marketplace",
            react:   templateFn(notification.data ?? {}) as React.ReactElement,
        }

        const { data, error } = await this.resendClient.emails.send(emailOptions)

        if (error || !data) {
            this.logger.error("[Resend] Failed to send email", error ?? "unknown error")
            return {}
        }

        this.logger.info(
            `[Resend] Sent → ${notification.to} | template: ${notification.template} | id: ${data.id}`
        )
        return { id: data.id }
    }
}

export default ResendNotificationProviderService
