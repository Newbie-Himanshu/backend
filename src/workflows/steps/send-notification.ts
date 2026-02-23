import { Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { CreateNotificationDTO } from "@medusajs/framework/types"

/**
 * Step: Send Notification via the Medusa Notification Module
 *
 * Passes the notification payload to the configured provider (Resend).
 * The Notification Module routes to the correct provider based on `channel`.
 */
export const sendNotificationStep = createStep(
    "send-notification",
    async (data: CreateNotificationDTO[], { container }) => {
        const notificationModuleService = container.resolve(Modules.NOTIFICATION)
        const notifications = await notificationModuleService.createNotifications(data)
        return new StepResponse(notifications)
    }
)
