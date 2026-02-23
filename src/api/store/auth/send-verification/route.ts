import crypto from "crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

// Token expires in 24 hours
const EXPIRY_HOURS = 24
const EXPIRY_MS    = EXPIRY_HOURS * 60 * 60 * 1000

/**
 * POST /store/auth/send-verification
 *
 * Generates a signed email verification token and sends the verification email.
 * Called automatically after a customer signs up (from the storefront signup server action).
 * Can also be called again to resend the verification link.
 *
 * Request body: { "customer_id": "cus_xxx", "email": "user@example.com" }
 *
 * The token is a self-contained HMAC-signed string — nothing is stored server-side.
 * Format: base64url( customerId:email:expiresAt:hmac )
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const { customer_id, email } = req.body as unknown as {
        customer_id?: string
        email?: string
    }

    if (!customer_id || !email) {
        return res.status(400).json({ error: "customer_id and email are required" })
    }

    // ── SECURITY: Validate customer_id/email pair against the database ────────
    // Without this check, an attacker can submit any customer_id with their own
    // email, receive a signed verification token, click the link, and mark the
    // victim's account as email_verified=true (account takeover).
    // We must confirm the provided email actually belongs to that customer_id.
    try {
        const queryClient = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
        const { data: customers } = await queryClient.graph({
            entity: "customer",
            fields: ["id", "email", "first_name", "last_name", "metadata"],
            filters: { id: customer_id },
        })

        const customer = customers?.[0] as any

        // customer_id does not exist in the database
        if (!customer) {
            // Return the same generic message as a mismatch to avoid user enumeration
            return res.status(400).json({ error: "Invalid request" })
        }

        // Email in the request must exactly match the customer's actual email
        if (customer.email.toLowerCase() !== email.toLowerCase()) {
            console.warn(`[EmailVerification] customer_id/email mismatch — possible account takeover attempt | customer_id: ${customer_id}`)
            return res.status(400).json({ error: "Invalid request" })
        }

        // ── Rate limiting: 5-minute cooldown per customer ─────────────────────────
        // Without this, an actor who has a valid customer_id+email pair (e.g. their
        // own account) can call this endpoint in a tight loop and:
        //   a) flood the target customer's inbox with verification emails
        //   b) exhaust the Resend free-tier quota, causing order-confirmation and
        //      other transactional emails to silently fail for ALL customers.
        const lastSentAt = customer.metadata?.last_verification_email_at as string | undefined
        if (lastSentAt) {
            const COOLDOWN_MS = 5 * 60 * 1000  // 5 minutes
            const elapsed = Date.now() - new Date(lastSentAt).getTime()
            if (elapsed < COOLDOWN_MS) {
                const waitSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000)
                return res.status(429).json({
                    error: `Please wait ${waitSeconds} seconds before requesting another verification email.`,
                })
            }
        }

        // ── Issue token using validated data from DB, not caller-supplied values ──
        const verifiedEmail = customer.email  // use DB email, not caller-supplied

        const secret = process.env.JWT_SECRET
        if (!secret) {
            console.error("[EmailVerification] JWT_SECRET environment variable is not set — cannot sign verification token")
            return res.status(500).json({ error: "Server configuration error" })
        }

        const storeUrl = process.env.STORE_URL
        if (!storeUrl) {
            console.error("[EmailVerification] STORE_URL environment variable is not set — cannot build verification link")
            return res.status(500).json({ error: "Server configuration error" })
        }

        const expiresAt = Date.now() + EXPIRY_MS
        const payload   = `${customer_id}:${verifiedEmail}:${expiresAt}`
        const hmac      = crypto.createHmac("sha256", secret).update(payload).digest("hex")
        const token     = Buffer.from(`${payload}:${hmac}`).toString("base64url")

        const verifyUrl = `${storeUrl}/auth/verify-email?token=${token}`

        let name: string | undefined
        if (customer.first_name) {
            name = [customer.first_name, customer.last_name].filter(Boolean).join(" ")
        }

        const notificationModule = req.scope.resolve(Modules.NOTIFICATION) as any
        await notificationModule.createNotifications({
            to:       verifiedEmail,
            channel:  "email",
            template: "email-verification",
            data: {
                name,
                verify_url:   verifyUrl,
                expiry_hours: EXPIRY_HOURS,
            },
        })

        console.log(`[EmailVerification] Verification email sent to ${verifiedEmail}`)

        // Record send timestamp so the cooldown check above can gate the next request
        try {
            const customerModule = req.scope.resolve(Modules.CUSTOMER) as any
            await customerModule.updateCustomers(customer_id, {
                metadata: { last_verification_email_at: new Date().toISOString() },
            })
        } catch {
            // Non-fatal — the email was sent; the cooldown simply won't apply next time
        }

        return res.status(200).json({ sent: true })

    } catch (err) {
        console.error("[EmailVerification] Failed to send verification email:", (err as Error).message)
        return res.status(500).json({ error: "Failed to send verification email" })
    }
}
