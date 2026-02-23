import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import Razorpay from "razorpay"

/**
 * GET /admin/custom/razorpay/config
 *
 * Returns Razorpay configuration status:
 * - mode: "test" | "live" based on key_id prefix
 * - key_id_masked: first 14 chars + "..." (safe to show in UI)
 * - webhook_endpoint: the full URL Razorpay should be sending events to
 * - webhook_reachable: true/false — whether a GET to the store's webhook path returns any response
 * - api_connected: true/false — whether a lightweight Razorpay API call succeeds
 * - account_id: Razorpay account ID (from env or from API)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const key_id = process.env.RAZORPAY_KEY_ID ?? ""
    const key_secret = process.env.RAZORPAY_KEY_SECRET ?? ""
    const razorpayAccount = process.env.RAZORPAY_ACCOUNT ?? ""

    const configured = Boolean(key_id && key_secret)
    const mode: "test" | "live" | "unknown" = !configured
        ? "unknown"
        : key_id.startsWith("rzp_test_")
        ? "test"
        : key_id.startsWith("rzp_live_")
        ? "live"
        : "unknown"

    const key_id_masked = key_id ? key_id.slice(0, 14) + "..." : ""

    // Resolve the store's public URL for webhook endpoint display
    const storeBase =
        process.env.BACKEND_URL ||
        process.env.STORE_URL ||
        "https://your-store.com"
    const webhook_endpoint = `${storeBase}/hooks/payment/razorpay`

    // Check API connectivity (fast: list 1 payment)
    let api_connected = false
    let api_error: string | null = null

    if (configured) {
        try {
            const rzp = new Razorpay({ key_id, key_secret })
            await (rzp.payments as any).all({ count: 1 })
            api_connected = true
        } catch (err: any) {
            api_error = err?.message ?? "API check failed"
        }
    }

    // Check if the webhook endpoint is reachable from the server
    // We only check reachability (any HTTP response = reachable, not 'healthy')
    let webhook_reachable = false
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 4000)
        const resp = await fetch(webhook_endpoint, {
            method: "POST",
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event: "health_check_ping" }),
        })
        clearTimeout(timeout)
        // Any HTTP response (even 400 = signature mismatch) means the route exists
        webhook_reachable = resp.status < 500
    } catch {
        webhook_reachable = false
    }

    res.json({
        configured,
        mode,
        key_id_masked,
        account_id: razorpayAccount || null,
        webhook_endpoint,
        webhook_reachable,
        api_connected,
        api_error,
        // Payment method hints — not dynamically togglable via API;
        // shown as informational toggles in the UI
        methods_info: {
            upi:        { enabled: true,  note: "Controlled via Razorpay Dashboard → Settings → Payment Methods" },
            card:       { enabled: true,  note: "Controlled via Razorpay Dashboard → Settings → Payment Methods" },
            netbanking: { enabled: true,  note: "Controlled via Razorpay Dashboard → Settings → Payment Methods" },
            wallet:     { enabled: true,  note: "Controlled via Razorpay Dashboard → Settings → Payment Methods" },
            emi:        { enabled: Boolean(process.env.RAZORPAY_EMI_ENABLED !== "false"),
                          note: "Set RAZORPAY_EMI_ENABLED=false in .env to disable EMI display" },
        },
        emi_widget_enabled: process.env.RAZORPAY_EMI_ENABLED !== "false",
    })
}
