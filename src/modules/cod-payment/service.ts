import crypto from "crypto"
import { AbstractPaymentProvider, MedusaError } from "@medusajs/framework/utils"
import {
    ProviderWebhookPayload,
    WebhookActionResult,
    InitiatePaymentInput,
    InitiatePaymentOutput,
    UpdatePaymentInput,
    UpdatePaymentOutput,
    AuthorizePaymentInput,
    AuthorizePaymentOutput,
    CapturePaymentInput,
    CapturePaymentOutput,
    CancelPaymentInput,
    CancelPaymentOutput,
    RefundPaymentInput,
    RefundPaymentOutput,
    RetrievePaymentInput,
    RetrievePaymentOutput,
    DeletePaymentInput,
    DeletePaymentOutput,
    GetPaymentStatusInput,
    GetPaymentStatusOutput,
} from "@medusajs/types"

export type CodOptions = {
    min_order_amount?: number    // in paise, default ₹100
    max_order_amount?: number    // in paise, default ₹50,000
    max_daily_orders?: number    // default 3
    new_customer_limit?: number  // in paise, default ₹1,500
    otp_threshold?: number       // in paise, default ₹3,000 — orders above this require OTP
    otp_expiry_minutes?: number  // OTP validity window, default 10 minutes
    // Twilio credentials — read from env by default, but can be overridden here
    twilio_account_sid?: string
    twilio_auth_token?: string
    twilio_from_phone?: string   // E.164 format, e.g. "+12015551234" or an Indian Twilio number
}

// ── OTP Utilities ─────────────────────────────────────────────────────────────

function generateOtp(): string {
    // Cryptographically random 6-digit OTP
    return String(crypto.randomInt(100000, 999999))
}

function hashOtp(otp: string, salt: string): string {
    return crypto.createHmac("sha256", salt).update(otp).digest("hex")
}

async function sendOtpViaTwilio(
    phone: string,
    otp: string,
    options: CodOptions
): Promise<void> {
    const accountSid  = options.twilio_account_sid  ?? process.env.TWILIO_ACCOUNT_SID
    const authToken   = options.twilio_auth_token   ?? process.env.TWILIO_AUTH_TOKEN
    const fromPhone   = options.twilio_from_phone   ?? process.env.TWILIO_FROM_PHONE

    if (!accountSid || !authToken || !fromPhone) {
        // Throw — not warn+return — so initiatePayment's try/catch blocks checkout.
        // A silent return here would create a phantom OTP session: otp_required=true
        // with a real hash stored but NO SMS sent. The customer sees the OTP prompt
        // but can never receive the code, permanently blocking their checkout.
        throw new Error(
            "[COD OTP] Twilio credentials not configured. Set TWILIO_ACCOUNT_SID, " +
            "TWILIO_AUTH_TOKEN, and TWILIO_FROM_PHONE in your .env file. " +
            "COD OTP cannot be sent without these credentials."
        )
    }

    // We use the Twilio REST API directly to avoid requiring the @twilio/twilio-node
    // SDK as a compile-time dependency (works with a simple fetch call).
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const body = new URLSearchParams({
        From: fromPhone,
        To:   phone,
        Body: `Your Vridhira Marketplace COD verification code is: ${otp}. Valid for ${options.otp_expiry_minutes ?? 10} minutes. Do not share this code with anyone.`,
    })

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        },
        body: body.toString(),
    })

    if (!response.ok) {
        const errorText = await response.text()
        console.error(`[COD OTP] Twilio SMS failed (${response.status}): ${errorText}`)
        throw new Error(`Failed to send OTP via Twilio: ${response.status}`)
    }

    const result = await response.json() as any
    console.log(`[COD OTP] OTP sent successfully to ${phone.replace(/\d(?=\d{4})/g, "*")} — SID: ${result.sid}`)
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Cash on Delivery Payment Provider for Vridhira Marketplace
 *
 * Implements industry-standard COD with fraud prevention:
 * - Order value limits (₹100 min, ₹50,000 max)               ← enforced in initiatePayment
 * - Twilio OTP verification for orders >= ₹3,000              ← enforced in initiatePayment + verifyOtp
 * - OTP reset on cart amount increase                         ← enforced in updatePayment
 *
 * NOTE — The following options are stored in `options_` for future use but are NOT
 * currently enforced at the payment-provider level because AbstractPaymentProvider's
 * `initiatePayment` receives no customer history. Enforce these in a custom
 * store API route (before calling /store/payment-sessions) if required:
 *
 *   max_daily_orders    — requires querying past orders for this customer today
 *   new_customer_limit  — requires checking if this is the customer's first order
 *
 * OTP Flow:
 *  1. initiatePayment() — if amount >= otp_threshold:
 *       generate OTP → hash it → store hash+salt+expiry in session data → send SMS via Twilio
 *  2. Storefront — calls POST /store/cod/verify-otp with { payment_session_id, otp }
 *       Backend route verifies OTP hash, sets otp_verified=true in session data
 *  3. authorizePayment() — if otp_required=true, rejects unless otp_verified=true
 */
class CodPaymentService extends AbstractPaymentProvider<CodOptions> {
    static identifier = "cod"

    protected options_: Required<CodOptions>

    constructor(container: Record<string, unknown>, options: CodOptions = {}) {
        super(container, options)
        this.options_ = {
            min_order_amount:    options.min_order_amount    ?? 10000,    // ₹100
            max_order_amount:    options.max_order_amount    ?? 5000000,  // ₹50,000
            max_daily_orders:    options.max_daily_orders    ?? 3,
            new_customer_limit:  options.new_customer_limit  ?? 150000,   // ₹1,500
            otp_threshold:       options.otp_threshold       ?? 300000,   // ₹3,000
            otp_expiry_minutes:  options.otp_expiry_minutes  ?? 10,
            twilio_account_sid:  options.twilio_account_sid  ?? "",
            twilio_auth_token:   options.twilio_auth_token   ?? "",
            twilio_from_phone:   options.twilio_from_phone   ?? "",
        }
    }

    /**
     * Verify a COD OTP during checkout.
     * Called by POST /store/cod/verify-otp — not part of AbstractPaymentProvider.
     *
     * @returns `{ verified: true }` on success
     * @throws MedusaError on invalid/expired OTP
     */
    async verifyOtp(
        sessionData: Record<string, unknown>,
        submittedOtp: string
    ): Promise<{ verified: true; updatedData: Record<string, unknown> }> {
        const { otp_required, otp_hash, otp_salt, otp_expires_at } = sessionData as any

        if (!otp_required) {
            // No OTP needed for this order
            return { verified: true, updatedData: sessionData }
        }

        // Defense-in-depth: also block here if the route somehow didn't catch it
        const attempts = Number(sessionData.otp_attempts ?? 0)
        if (attempts >= 5) {
            throw new MedusaError(
                MedusaError.Types.NOT_ALLOWED,
                "Too many failed OTP attempts. Please restart checkout to receive a new code."
            )
        }

        if (!otp_hash || !otp_salt || !otp_expires_at) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "OTP session data is invalid. Please restart checkout."
            )
        }

        // Check expiry
        if (Date.now() > Number(otp_expires_at)) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "OTP has expired. Please request a new OTP."
            )
        }

        // Verify hash — use timingSafeEqual to prevent timing-oracle attacks
        const computedHash = hashOtp(submittedOtp.trim(), otp_salt as string)
        const computedBuf  = Buffer.from(computedHash, "hex")
        const storedBuf    = Buffer.from(otp_hash as string, "hex")

        if (
            computedBuf.length !== storedBuf.length ||
            !crypto.timingSafeEqual(computedBuf, storedBuf)
        ) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "Invalid OTP. Please check the code sent to your phone."
            )
        }

        return {
            verified: true,
            updatedData: {
                ...sessionData,
                otp_verified: true,
                otp_verified_at: new Date().toISOString(),
                // Clear sensitive hash fields after successful verification
                otp_hash: null,
                otp_salt: null,
            },
        }
    }

    /**
     * Validate COD eligibility based on order amount
     */
    private validateOrderAmount(amount: number): void {
        if (amount < this.options_.min_order_amount!) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                `COD is not available for orders below ₹${this.options_.min_order_amount! / 100}`
            )
        }
        if (amount > this.options_.max_order_amount!) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                `COD is not available for orders above ₹${this.options_.max_order_amount! / 100}`
            )
        }
    }

    /**
     * Initiate a COD payment session.
     *
     * For orders >= otp_threshold (default ₹3,000):
     *   1. Generates a cryptographically random 6-digit OTP
     *   2. Hashes it with a per-session salt (HMAC-SHA256) — never stored in plain text
     *   3. Sends the OTP to the customer's phone via Twilio SMS
     *   4. Stores hash + salt + expiry in session data
     *   5. Sets `otp_required: true` — authorizePayment will block until OTP is verified
     *
     * The storefront must call POST /store/cod/verify-otp before completing checkout.
     */
    async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
        const { amount, currency_code, context } = input

        // Validate currency — COD only for INR
        if (currency_code?.toUpperCase() !== "INR") {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "COD is only available for INR orders"
            )
        }

        this.validateOrderAmount(Number(amount))

        // Use cryptographically random bytes — Math.random() is not secure enough
        // for a session ID that is shared with the client and stored in the DB.
        const sessionId   = `cod_${crypto.randomBytes(16).toString("hex")}`
        const numericAmount = Number(amount)
        const needsOtp    = numericAmount >= this.options_.otp_threshold

        const baseData: Record<string, unknown> = {
            status: "pending",
            amount,
            currency: currency_code,
            created_at: new Date().toISOString(),
            payment_method: "cash_on_delivery",
        }

        if (!needsOtp) {
            return { id: sessionId, data: { ...baseData, otp_required: false } }
        }

        // ── OTP required path ──────────────────────────────────────────────
        // Resolve phone number: prefer customer phone, fall back to billing address
        const phone: string | undefined =
            (context as any)?.customer?.phone ||
            (context as any)?.billing_address?.phone ||
            (context as any)?.shipping_address?.phone

        if (!phone) {
            // A phone number is mandatory for high-value COD orders.
            // Silently skipping OTP would allow fraudulent high-value COD orders
            // from guest accounts with no phone. Fail hard instead.
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                `A phone number is required for COD orders above ₹${this.options_.otp_threshold / 100}. Please add a phone number to your account or address.`
            )
        }

        const otp        = generateOtp()
        const salt       = crypto.randomBytes(16).toString("hex")
        const otpHash    = hashOtp(otp, salt)
        const expiresAt  = Date.now() + this.options_.otp_expiry_minutes * 60 * 1000

        try {
            await sendOtpViaTwilio(phone, otp, this.options_)
        } catch (err) {
            // Twilio failure must BLOCK checkout, not silently bypass OTP.
            // A Twilio outage or suspended number cannot become a fraud vector.
            console.error(`[COD OTP] Failed to send OTP to phone for session ${sessionId}:`, (err as Error).message)
            throw new MedusaError(
                MedusaError.Types.UNEXPECTED_STATE,
                "Could not send the OTP to your phone number. Please try again in a moment or use a different payment method."
            )
        }

        console.log(`[COD OTP] OTP initiated for session ${sessionId} | amount: ₹${numericAmount / 100} | expires: ${new Date(expiresAt).toISOString()}`)

        return {
            id: sessionId,
            data: {
                ...baseData,
                otp_required: true,
                otp_verified: false,
                otp_hash:     otpHash,
                otp_salt:     salt,
                otp_expires_at: expiresAt,
                otp_phone_last4: phone.slice(-4), // for UI display only
            },
        }
    }

    /**
     * Update COD payment session (e.g., amount changed due to cart edit).
     *
     * SECURITY: If the new amount crosses the OTP threshold, we must reset
     * any previously verified OTP state and mark `otp_required: true` again.
     * Without this, a customer could:
     *   1. Start checkout at ₹2,999 (below threshold, no OTP)
     *   2. Complete OTP verification (or just wait while at ₹3,001)
     *   3. Add an item → amount rises to ₹4,500
     *   4. `otp_verified: true` is still in session → authorizePayment passes without OTP
     *
     * The storefront must detect `otp_required: true && otp_verified: false` after
     * a cart update and prompt the customer to re-verify (call verify-otp again).
     * A new OTP is NOT auto-sent here because updatePayment has no phone context;
     * the customer must initiate a new OTP via the storefront's resend action.
     */
    async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
        const { amount, currency_code, data } = input
        const currentData = (data ?? {}) as Record<string, unknown>

        if (currency_code?.toUpperCase() !== "INR") {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "COD is only available for INR orders"
            )
        }

        const newAmount = Number(amount)
        this.validateOrderAmount(newAmount)

        const prevAmount     = Number(currentData.amount ?? 0)
        const nowNeedsOtp    = newAmount >= this.options_.otp_threshold
        const wasOtpVerified = currentData.otp_verified === true
        const wasOtpRequired = currentData.otp_required === true

        // Reset OTP verification if:
        //   a) Amount now crosses the threshold from below (first time OTP needed), OR
        //   b) Amount *increased* after OTP was already verified (prevents bypass)
        const shouldResetOtp =
            (nowNeedsOtp && !wasOtpRequired) ||
            (wasOtpVerified && newAmount > prevAmount && nowNeedsOtp)

        if (shouldResetOtp) {
            console.log(
                `[COD] OTP state reset on updatePayment — amount: ₹${prevAmount / 100} → ₹${newAmount / 100}`
            )
            return {
                data: {
                    ...currentData,
                    amount,
                    updated_at:    new Date().toISOString(),
                    otp_required:  true,
                    otp_verified:  false,
                    // Invalidate old OTP hashes so the old code cannot be replayed
                    otp_hash:      null,
                    otp_salt:      null,
                    otp_expires_at: null,
                    otp_attempts:  0,
                },
            }
        }

        return {
            data: {
                ...currentData,
                amount,
                updated_at:   new Date().toISOString(),
                // Keep otp_required in sync with the threshold even if not resetting
                otp_required: nowNeedsOtp,
            },
        }
    }

    /**
     * Authorize COD payment.
     *
     * If OTP verification is required (otp_required=true), the payment WILL NOT be
     * authorized until the storefront has called POST /store/cod/verify-otp and the
     * session data contains `otp_verified: true`.
     *
     * Payment on delivery — captured = cash collected by courier.
     */
    async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
        const data = (input.data ?? {}) as Record<string, unknown>

        if (data.otp_required === true && data.otp_verified !== true) {
            throw new MedusaError(
                MedusaError.Types.NOT_ALLOWED,
                "COD OTP verification is required for this order amount. Please verify the OTP sent to your phone."
            )
        }

        return {
            status: "authorized",
            data: {
                ...data,
                authorized_at: new Date().toISOString(),
                status: "authorized",
            },
        }
    }

    /**
     * Capture COD payment — marked as captured when courier collects cash.
     */
    async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
        return {
            data: {
                ...(input.data as Record<string, unknown>),
                captured_at: new Date().toISOString(),
                status: "captured",
            },
        }
    }

    /**
     * Cancel COD payment.
     */
    async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
        return {
            data: {
                ...(input.data as Record<string, unknown>),
                cancelled_at: new Date().toISOString(),
                status: "cancelled",
            },
        }
    }

    /**
     * Refund COD payment — handled manually (bank transfer or store credit).
     */
    async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
        return {
            data: {
                ...(input.data as Record<string, unknown>),
                refunded_amount: input.amount,
                refunded_at: new Date().toISOString(),
                status: "refunded",
                refund_note: "COD refund — process via bank transfer or store credit",
            },
        }
    }

    /**
     * Retrieve payment session data.
     */
    async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
        return { data: input.data as Record<string, unknown> }
    }

    /**
     * Delete payment session.
     */
    async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
        return { data: input.data as Record<string, unknown> }
    }

    /**
     * Get payment status from session data.
     */
    async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
        const status = (input.data?.status as string) ?? "pending"
        switch (status) {
            case "captured":
                return { status: "captured" }
            case "authorized":
                return { status: "authorized" }
            case "cancelled":
                return { status: "canceled" }
            default:
                return { status: "pending" }
        }
    }

    /**
     * Handle webhooks — COD doesn't have external webhooks.
     */
    async getWebhookActionAndData(
        _payload: ProviderWebhookPayload["payload"]
    ): Promise<WebhookActionResult> {
        return { action: "not_supported" }
    }
}

export default CodPaymentService
