import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import CodPaymentService from "../../../../modules/cod-payment/service"

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
const MAX_OTP_ATTEMPTS = 5

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

    // Reject suspiciously long inputs early — valid OTPs are 6 digits
    if (typeof otp !== "string" || !/^\d{4,8}$/.test(otp.trim())) {
        return res.status(400).json({ error: "OTP must be a 4–8 digit number" })
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

            try {
                await paymentModule.updatePaymentSession({
                    id: payment_session_id,
                    data: lockedData,
                })
            } catch (persistErr) {
                // Best-effort — log but don't mask the original error
                console.error("[COD OTP] Failed to persist attempt count:", (persistErr as Error).message)
            }

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

        console.log(`[COD OTP] OTP successfully verified for session ${payment_session_id}`)

        return res.status(200).json({
            verified: true,
            message: "OTP verified successfully. You can now place your order.",
        })

    } catch (error: any) {
        const isMedusaError = error?.name === "MedusaError" || error?.type
        const statusCode = isMedusaError ? 400 : 500

        console.error(`[COD OTP] Verification failed for session ${payment_session_id}:`, error.message)

        return res.status(statusCode).json({
            error: error.message ?? "OTP verification failed",
        })
    }
}
