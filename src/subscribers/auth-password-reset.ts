import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Auth Password Reset Subscriber
 *
 * Medusa fires `auth.password_reset` when POST /auth/customer/emailpass/reset-password
 * is called. The event payload contains the signed reset token.
 *
 * We catch it here and send the customer a "Reset your password" email via Resend
 * with a link that includes the token.
 *
 * Reset link format:
 *   {STORE_URL}/{countryCode}/account/reset-password?token={token}&email={email}
 *
 * The storefront reset-password page reads those params, lets the user enter a new
 * password, then calls POST /auth/customer/emailpass/update-provider with the token.
 */
export default async function authPasswordResetHandler({
    event: { data },
    container,
}: SubscriberArgs<{
    entity_id: string   // the customer's email address
    actor_type: string  // "customer"
    service: string     // "emailpass"
    token: string       // signed reset token from Medusa
}>) {
    const { entity_id: email, token, actor_type } = data

    // Only handle customer password resets
    if (actor_type !== "customer") return

    if (!email || !token) {
        console.warn("[PasswordReset] Missing email or token in auth.password_reset event")
        return
    }

    try {
        // ── Resolve customer name for personalisation ─────────────────────
        const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
        let name: string | undefined

        try {
            const { data: customers } = await query.graph({
                entity: "customer",
                fields: ["first_name", "last_name"],
                filters: { email },
            })
            const customer = customers?.[0] as any
            if (customer?.first_name) {
                name = [customer.first_name, customer.last_name].filter(Boolean).join(" ")
            }
        } catch {
            // Non-fatal — personalisation is optional
        }

        // ── Build reset URL ───────────────────────────────────────────────
        const storeUrl = process.env.STORE_URL
        if (!storeUrl) {
            console.error("[PasswordReset] STORE_URL environment variable is not set — cannot build reset link")
            return
        }
        // Use a locale-neutral path — the storefront middleware will redirect to the
        // correct locale automatically (e.g. /in/account/reset-password).
        const resetUrl = `${storeUrl}/account/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`

        // ── Send email via notification module ────────────────────────────
        const notificationModule = container.resolve(Modules.NOTIFICATION) as any
        await notificationModule.createNotifications({
            to:       email,
            channel:  "email",
            template: "password-reset",
            data: {
                name,
                reset_url:      resetUrl,
                expiry_minutes: 15,
            },
        })

        console.log(`[PasswordReset] Reset email sent to ${email}`)

    } catch (err) {
        console.error("[PasswordReset] Failed to send reset email:", (err as Error).message)
    }
}

export const config: SubscriberConfig = {
    event: "auth.password_reset",
    context: { subscriberId: "Himanshu-auth-password-reset" },
}
