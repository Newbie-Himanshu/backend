import crypto from "crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import logger from "../../../../lib/logger"

const log = logger.child({ module: "verify-email" })

/**
 * GET /store/auth/verify-email?token=xxx
 *
 * Validates the signed email verification token, then marks the customer as
 * verified by setting metadata.email_verified = true.
 *
 * The storefront /auth/verify-email page hits this endpoint with the ?token
 * query param received from the verification link in the email.
 *
 * Token format (base64url-encoded): customerId:email:expiresAt:hmac
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const token = (req.query as Record<string, string>).token

    if (!token) {
        return res.status(400).json({ verified: false, error: "Missing token" })
    }

    const secret = process.env.JWT_SECRET
    if (!secret) {
        log.error("JWT_SECRET environment variable is not set — cannot verify token")
        return res.status(500).json({ verified: false, error: "Server configuration error" })
    }

    // ── Decode + parse ────────────────────────────────────────────────────
    let customerId: string, email: string, expiresAt: number, receivedHmac: string
    try {
        const decoded = Buffer.from(token, "base64url").toString("utf8")
        const parts   = decoded.split(":")
        if (parts.length !== 4) throw new Error("bad format")
        ;[customerId, email, , receivedHmac] = parts
        expiresAt = Number(parts[2])
        if (isNaN(expiresAt)) throw new Error("bad expiry")
    } catch {
        return res.status(400).json({ verified: false, error: "Invalid token format" })
    }

    // ── Check expiry ──────────────────────────────────────────────────────
    if (Date.now() > expiresAt) {
        return res.status(400).json({
            verified: false,
            error:    "Verification link has expired. Please request a new one.",
        })
    }

    // ── Verify HMAC ───────────────────────────────────────────────────────
    // Validate HMAC format first: must be exactly 64 lowercase hex chars.
    // Buffer.from(str, "hex") silently truncates invalid/odd-length hex strings,
    // producing a buffer shorter than expected — crypto.timingSafeEqual would then
    // throw (length mismatch) instead of returning false, turning a 400 into a 500.
    if (!/^[0-9a-fA-F]{64}$/.test(receivedHmac)) {
        return res.status(400).json({ verified: false, error: "Invalid or tampered token" })
    }

    const expectedHmac = crypto
        .createHmac("sha256", secret)
        .update(`${customerId}:${email}:${expiresAt}`)
        .digest("hex")

    if (!crypto.timingSafeEqual(
        Buffer.from(receivedHmac, "hex"),
        Buffer.from(expectedHmac, "hex"),
    )) {
        return res.status(400).json({ verified: false, error: "Invalid or tampered token" })
    }

    // ── Re-validate: confirm the customer's current email still matches the token ─
    // Without this check, a token issued before an email change would mark the
    // *new* email as verified even though the link was sent to the *old* email.
    // Also acts as an additional guard against forged customer_id values that
    // somehow passed HMAC verification (defense in depth).
    try {
        const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
        const { data: customers } = await query.graph({
            entity: "customer",
            fields: ["id", "email"],
            filters: { id: customerId },
        })
        const customer = customers?.[0] as any
        if (!customer) {
            return res.status(400).json({ verified: false, error: "Account not found" })
        }
        if (customer.email.toLowerCase() !== email.toLowerCase()) {
            log.warn(
                { tokenEmail: email, currentEmail: customer.email },
                "Token email no longer matches current account email — token invalid"
            )
            return res.status(400).json({
                verified: false,
                error: "This verification link is no longer valid. Please request a new one.",
            })
        }
    } catch (queryErr) {
        log.error({ err: queryErr }, "Failed to re-validate customer email:", (queryErr as Error).message)
        return res.status(500).json({ verified: false, error: "Verification failed" })
    }

    // ── Mark customer as verified ─────────────────────────────────────────
    try {
        const customerModule = req.scope.resolve(Modules.CUSTOMER) as any
        await customerModule.updateCustomers(customerId, {
            metadata: { email_verified: true, email_verified_at: new Date().toISOString() },
        })

        log.info({ customerId, email }, "Customer ${customerId} (${email}) verified`)
        return res.status(200).json({ verified: true, email })

    } catch (err) {
        log.error({ err }, "Failed to update customer metadata:", (err as Error).message)
        return res.status(500).json({ verified: false, error: "Failed to verify email" })
    }
}
