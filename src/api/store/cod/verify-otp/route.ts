import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import CodPaymentService, { MAX_OTP_ATTEMPTS } from "../../../../modules/cod-payment/service"
import logger from "../../../../lib/logger"

const log = logger.child({ module: "cod-verify-otp" })

/**
 * POST /store/cod/verify-otp
 *
 * Verifies the COD OTP for a payment session.
 * Call this endpoint after the customer enters the OTP on the checkout page
 * and BEFORE calling the complete-cart / confirm-payment endpoint.
 *
 * Request body:
 * {
 *   "payment_session_id": "cod_1234567890_abc123",
 *   "otp": "482910"
 * }
 *
 * Success response (200):
 * { "verified": true, "message": "OTP verified successfully" }
 *
 * Error response (400):
 * { "error": "Invalid OTP. Please check the code sent to your phone." }
 *
 * The endpoint updates the payment session's data to set `otp_verified: true`,
 * which allows authorizePayment() to proceed.
 *
 * Brute-force protection:
 *   After MAX_OTP_ATTEMPTS consecutive failures the session is permanently locked.
 *   The customer must restart checkout to get a new OTP session.
 *   A 6-digit OTP has 900,000 combinations; 5 attempts = 0.00056% brute-force success.
 */

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const { payment_session_id, otp } = req.body as {
        payment_session_id?: string
        otp?: string
    }

    if (!payment_session_id || !otp) {
        return res.status(400).json({
            error: "payment_session_id and otp are required",
        })
    }

    // Bound payment_session_id length — valid IDs are ~36 chars ("cod_" + 32 hex).
    // Reject absurdly long strings before they reach the database layer.
    if (typeof payment_session_id !== "string" || payment_session_id.length > 200) {
        return res.status(400).json({ error: "Invalid payment_session_id" })
    }

    // Reject non-6-digit inputs early — OTPs are always generated as exactly 6 digits.
    // Accepting 4-8 digit inputs would let a customer supply a valid-looking but
    // always-wrong OTP, wasting an attempt with a confusing "Invalid OTP" message
    // instead of the correct "OTP must be a 6-digit number" feedback.
    if (typeof otp !== "string" || !/^\d{6}$/.test(otp.trim())) {
        return res.status(400).json({ error: "OTP must be a 6-digit number" })
    }

    try {
        // ── 1. Fetch the payment session ──────────────────────────────────
        const paymentModule = req.scope.resolve(Modules.PAYMENT) as any
        const paymentSession = await paymentModule.retrievePaymentSession(
            payment_session_id
        )

        if (!paymentSession) {
            return res.status(404).json({ error: "Payment session not found" })
        }

        // ── 2. Confirm this is a COD session ─────────────────────────────
        if (paymentSession.provider_id !== "pp_cod_cod" && paymentSession.provider_id !== "cod") {
            return res.status(400).json({
                error: "OTP verification is only applicable to COD payment sessions",
            })
        }

        // ── 2.5. Customer ownership check ─────────────────────────────────
        // Ensure the payment session belongs to the authenticated customer's cart.
        // Without this, any logged-in customer who obtains another customer's
        // payment_session_id (e.g. via URL sharing or IDOR) could lock out that
        // session by exhausting OTP attempts, or verify a session they don't own.
        const customerId = (req as any).auth_context?.actor_id as string | undefined
        if (!customerId) {
            return res.status(401).json({ error: "Authentication required" })
        }
        {
            const queryClient = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
            const pcId = paymentSession.payment_collection_id as string | undefined
            if (pcId) {
                const { data: collections } = await queryClient.graph({
                    entity: "payment_collection",
                    fields: ["id", "cart_id"],
                    filters: { id: pcId },
                })
                const collection = (collections as any[])?.[0]
                const cartId = collection?.cart_id as string | undefined
                if (cartId) {
                    const { data: carts } = await queryClient.graph({
                        entity: "cart",
                        fields: ["id", "customer_id"],
                        filters: { id: cartId },
                    })
                    const cart = (carts as any[])?.[0]
                    if (!cart || cart.customer_id !== customerId) {
                        log.warn({ session_id: payment_session_id, cart_owner: cart?.customer_id ?? "unknown", requester: customerId }, "COD OTP ownership check failed")
                        return res.status(403).json({ error: "You do not have permission to verify this payment session" })
                    }
                }
            }
        }
        // ── End ownership check ───────────────────────────────────────────

        const sessionData = (paymentSession.data ?? {}) as Record<string, unknown>

        // ── 3. Brute-force lockout check ──────────────────────────────────
        // Attempt count is stored in the payment session so it survives across
        // requests. This prevents parallel or rapid sequential attempts.
        const attempts = Number(sessionData.otp_attempts ?? 0)
        if (attempts >= MAX_OTP_ATTEMPTS) {
            return res.status(429).json({
                error: "Too many failed OTP attempts. Please restart checkout to receive a new code.",
                locked: true,
            })
        }

        // ── 4. Get the COD payment service and verify the OTP ─────────────
        let codService: CodPaymentService
        try {
            codService = req.scope.resolve("pp_cod_cod") as CodPaymentService
        } catch {
            codService = req.scope.resolve("cod") as CodPaymentService
        }

        let updatedData: Record<string, unknown>

        try {
            const result = await codService.verifyOtp(sessionData, otp)
            updatedData = result.updatedData
        } catch (verifyError: any) {
            // Verification failed — increment attempt counter and persist it
            // so the next request also sees the updated attempt count.
            const newAttempts = attempts + 1
            const lockedData = { ...sessionData, otp_attempts: newAttempts }

            // Persist the attempt counter — do NOT swallow errors here.
            // If we can't write the counter to the DB, we cannot guarantee that
            // brute-force protection is active; returning a 500 is safer than
            // reporting a wrong-OTP response with an untracked attempt.
            await paymentModule.updatePaymentSession({
                id: payment_session_id,
                data: lockedData,
            })

            const remaining = MAX_OTP_ATTEMPTS - newAttempts
            const isMedusaError = verifyError?.name === "MedusaError" || verifyError?.type

            if (newAttempts >= MAX_OTP_ATTEMPTS) {
                return res.status(429).json({
                    error: "Too many failed OTP attempts. Please restart checkout to receive a new code.",
                    locked: true,
                })
            }

            return res.status(isMedusaError ? 400 : 500).json({
                error: verifyError.message ?? "OTP verification failed",
                attempts_remaining: remaining,
            })
        }

        // ── 5. Persist the updated session data (otp_verified=true, hash cleared) ──
        await paymentModule.updatePaymentSession({
            id: payment_session_id,
            data: updatedData,
        })

        log.info({ session_id: payment_session_id }, "COD OTP successfully verified")

        return res.status(200).json({
            verified: true,
            message: "OTP verified successfully. You can now place your order.",
        })

    } catch (error: any) {
        const isMedusaError = error?.name === "MedusaError" || error?.type
        const statusCode = isMedusaError ? 400 : 500

        log.error({ err: error, session_id: payment_session_id }, "COD OTP verification failed")

        return res.status(statusCode).json({
            error: error.message ?? "OTP verification failed",
        })
    }
}
