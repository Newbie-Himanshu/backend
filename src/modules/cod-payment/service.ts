import crypto from "crypto"
import { AbstractPaymentProvider, MedusaError } from "@medusajs/framework/utils"
import logger from "../../lib/logger"
import { getRedisClient } from "../../lib/redis-client"

const log = logger.child({ module: "cod-payment" })
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

/** Shared constant — imported by POST /store/cod/verify-otp so both layers lockout at the same threshold */
export const MAX_OTP_ATTEMPTS = 5

export type CodOptions = {
    min_order_amount?: number    // in paise, default ₹100
    max_order_amount?: number    // in paise, default ₹50,000
    max_daily_orders?: number    // default 3
    new_customer_limit?: number  // in paise, default ₹1,500
    otp_threshold?: number       // in paise, default ₹3,000 — orders above this require OTP
    otp_expiry_minutes?: number  // OTP validity window, default 10 minutes
    // MSG91 credentials — read from env by default, but can be overridden here
    msg91_auth_key?: string      // From MSG91 Dashboard → API Keys
    msg91_template_id?: string   // Approved DLT OTP template ID from MSG91 → SendOTP → Templates
    msg91_sender_id?: string     // 6-char DLT Sender ID (e.g. "VRDHIR"). Optional — defaults to MSG91 dashboard value
}

// ── OTP Utilities ─────────────────────────────────────────────────────────────

function generateOtp(): string {
    // Cryptographically random 6-digit OTP
    return String(crypto.randomInt(100000, 999999))
}

function hashOtp(otp: string, salt: string): string {
    return crypto.createHmac("sha256", salt).update(otp).digest("hex")
}

/**
 * Validates that a phone number is a plausible Indian mobile number.
 * Accepts formats: 10 digits (9XXXXXXXX), +91XXXXXXXXXX, 91XXXXXXXXXX.
 * Returns the normalised 12-digit MSG91 format (91XXXXXXXXXX) on success,
 * or throws a MedusaError so the customer gets a clear checkout error.
 *
 * Why this matters:
 *   Without validation, a customer who sets a landline, an international number,
 *   or a malformed string as their billing phone will hit MSG91 and get an opaque
 *   "OTP send failed" error instead of a clear "please enter a valid mobile number".
 *   Also prevents SMS being sent to unrelated numbers in other countries.
 */
function validateAndNormaliseIndianPhone(raw: string): string {
    // Strip all whitespace and common formatting characters
    const cleaned = raw.replace(/[\s()\-]/g, "")

    // Match:
    //   +91XXXXXXXXXX  (international format)
    //    91XXXXXXXXXX  (without +)
    //      XXXXXXXXXX  (local 10-digit format, starting with 6–9)
    const match =
        cleaned.match(/^(?:\+?91)(\d{10})$/) ??
        cleaned.match(/^([6-9]\d{9})$/)

    if (!match) {
        throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "A valid Indian mobile number (10 digits starting with 6–9) is required for COD orders " +
            "above the OTP threshold. Please update your phone number to a valid Indian mobile."
        )
    }

    // Normalise to 91XXXXXXXXXX (MSG91 expected format, no leading +)
    return `91${match[1]}`
}

async function sendOtpViaMSG91(
    phone: string,
    otp: string,
    options: CodOptions
): Promise<void> {
    const authKey    = options.msg91_auth_key    || process.env.MSG91_AUTH_KEY
    const templateId = options.msg91_template_id || process.env.MSG91_OTP_TEMPLATE_ID
    const senderId   = options.msg91_sender_id   || process.env.MSG91_SENDER_ID

    if (!authKey || !templateId) {
        // Throw — not warn+return — so initiatePayment's try/catch blocks checkout.
        // A silent return here would create a phantom OTP session: otp_required=true
        // with a real hash stored but NO SMS sent. The customer sees the OTP prompt
        // but can never receive the code, permanently blocking their checkout.
        throw new Error(
            "[COD OTP] MSG91 credentials not configured. Set MSG91_AUTH_KEY and " +
            "MSG91_OTP_TEMPLATE_ID in your .env file. " +
            "COD OTP cannot be sent without these credentials."
        )
    }

    // MSG91 SendOTP API — JSON POST, authkey in header.
    // Phone must be in format 91XXXXXXXXXX (country code + number, no leading +).
    // Docs: https://docs.msg91.com/reference/send-otp
    const mobile = phone.startsWith("+") ? phone.slice(1) : phone

    const payload: Record<string, string> = {
        template_id: templateId,
        mobile,
        otp,
    }
    if (senderId) payload.sender = senderId

    const response = await fetch("https://control.msg91.com/api/v5/otp", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            authkey: authKey,
        },
        body: JSON.stringify(payload),
    })

    if (!response.ok) {
        const errorText = await response.text()
        console.error(`[COD OTP] MSG91 SMS failed (${response.status}): ${errorText}`)
        throw new Error(`Failed to send OTP via MSG91: ${response.status}`)
    }

    const result = await response.json() as any
    log.info({ request_id: result.request_id ?? "ok", phone_masked: phone.replace(/\d(?=\d{4})/g, "*") }, "OTP sent via MSG91")
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Cash on Delivery Payment Provider for Vridhira Marketplace
 *
 * Implements industry-standard COD with fraud prevention:
 * - Order value limits (₹100 min, ₹50,000 max)               ← enforced in initiatePayment
 *   - MSG91 OTP verification for orders >= ₹3,000               ← enforced in initiatePayment + verifyOtp
 * - OTP reset on cart amount increase                         ← enforced in updatePayment
 *
 * ⚠️  KNOWN LIMITATION — The following options are stored in `options_` for future use
 * but are NOT currently enforced at the payment-provider level because
 * AbstractPaymentProvider's `initiatePayment` receives no customer history context.
 * Until enforced, these settings exist in config but have NO runtime effect on fraud prevention.
 * To enforce them, add a custom store API route (called BEFORE /store/payment-sessions)
 * that queries the customer's order history and rejects the session if limits are exceeded:
 *
 *   max_daily_orders    — requires querying past orders for this customer today
 *   new_customer_limit  — requires checking if this is the customer's first ever order
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
            max_daily_orders:    options.max_daily_orders    ?? 0,        // 0 = no limit
            new_customer_limit:  options.new_customer_limit  ?? 0,        // 0 = no limit
            otp_threshold:       options.otp_threshold       ?? 250000,   // ₹2,500
            otp_expiry_minutes:  options.otp_expiry_minutes  ?? 10,
            msg91_auth_key:      options.msg91_auth_key      ?? "",
            msg91_template_id:   options.msg91_template_id   ?? "",
            msg91_sender_id:     options.msg91_sender_id     ?? "",
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
        if (attempts >= MAX_OTP_ATTEMPTS) {
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
     * Public wrapper for sendOtpViaMSG91 — used by the admin resend API route.
     * Credentials and sender config are read from this.options_ (which falls back to env vars).
     */
    async sendOtp(phone: string, otp: string): Promise<void> {
        return sendOtpViaMSG91(phone, otp, this.options_)
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
     *   3. Sends the OTP to the customer's phone via MSG91 SendOTP API
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

        // Validate and normalise to MSG91's expected format (91XXXXXXXXXX).
        // Throws a clear, customer-facing MedusaError for landlines or non-Indian numbers.
        const normalisedPhone = validateAndNormaliseIndianPhone(phone)

        const otp        = generateOtp()
        const salt       = crypto.randomBytes(16).toString("hex")
        const otpHash    = hashOtp(otp, salt)
        const expiresAt  = Date.now() + this.options_.otp_expiry_minutes * 60 * 1000

        // ── Redis OTP send rate limit ─────────────────────────────────────
        // Prevents SMS bombing: at most 1 OTP SMS per phone number per 60 seconds.
        // Fail open on Redis errors so a Redis outage never blocks checkout.
        try {
            const redis = getRedisClient()
            const rlKey = `cod:otp:rl:${normalisedPhone}`
            // ioredis v5 typings don't cover SET + NX + EX in one overload.
            // Use call() (raw Redis command) for the atomic SET NX EX.
            const set = await redis.call("SET", rlKey, "1", "NX", "EX", "60") as string | null
            if (set === null) {
                throw new MedusaError(
                    MedusaError.Types.NOT_ALLOWED,
                    "An OTP was recently sent to this number. Please wait 60 seconds before requesting a new code."
                )
            }
        } catch (rlErr) {
            if (rlErr instanceof MedusaError) throw rlErr
            // Redis unavailable — log and continue (fail open)
            log.warn({ err: rlErr }, "Redis OTP rate-limit check unavailable — proceeding without limit")
        }

        try {
            await sendOtpViaMSG91(normalisedPhone, otp, this.options_)
        } catch (err) {
            // MSG91 failure must BLOCK checkout, not silently bypass OTP.
            // A MSG91 outage or misconfiguration cannot become a fraud vector.
            log.error({ err, sessionId }, "Failed to send OTP via MSG91")
            throw new MedusaError(
                MedusaError.Types.UNEXPECTED_STATE,
                "Could not send the OTP to your phone number. Please try again in a moment or use a different payment method."
            )
        }

        log.info({ sessionId, amount_inr: numericAmount / 100, expires: new Date(expiresAt).toISOString() }, "COD OTP initiated")

        return {
            id: sessionId,
            data: {
                ...baseData,
                otp_required: true,
                otp_verified: false,
                otp_hash:     otpHash,
                otp_salt:     salt,
                otp_expires_at: expiresAt,
                otp_phone_last4: normalisedPhone.slice(-4), // for UI display only
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
            log.info({ prev_amount_inr: prevAmount / 100, new_amount_inr: newAmount / 100 }, "COD OTP state reset on amount change")
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
