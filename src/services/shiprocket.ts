import { MedusaError } from "@medusajs/framework/utils"

type ShiprocketAuthResponse = {
    token: string
    email: string
}

// ── Remittance Types ──────────────────────────────────────────────────────────

export type RemittanceStatus = "PENDING" | "REMITTED" | "NOT_REMITTED"

export type RemittanceEntry = {
    id: number
    date: string                    // date when Shiprocket collected cash from courier
    transaction_id: string          // Shiprocket's internal transaction / batch ID
    amount: number                  // INR — total cash collected in this batch
    debit_credit_flag: string       // "COD_RECEIVED" etc.
    awbs: string                    // comma-separated AWB numbers in this batch
    orders: string                  // comma-separated channel_order_ids in this batch
    status: RemittanceStatus
    remittance_date?: string        // date when Shiprocket transferred to your bank
    utr?: string                    // bank UTR number of the transfer
}

export type RemittanceListResult = {
    entries: RemittanceEntry[]
    total: number
    page: number
    total_pages: number
    per_page: number
}

export type RemittanceSummary = {
    total_pending_amount: number        // INR — batches Shiprocket has collected but not yet sent to bank
    total_remitted_last_30d: number     // INR — transferred to your bank in last 30 days
    total_remitted_last_90d: number     // INR — transferred to your bank in last 90 days
    pending_batch_count: number
    remitted_batch_count_last_30d: number
    last_remittance_date: string | null // ISO date string or null
    last_remittance_amount: number      // INR — amount of the most recent transfer
    window_from: string                 // ISO date — start of summary window
    window_to: string                   // ISO date — end of summary window
}

type ServiceabilityResponse = {
    status: number
    data: {
        available_courier_companies: Array<{
            courier_name: string
            courier_company_id: number
            rate: number
            estimated_delivery_days: number
            cod: boolean
        }>
    }
}

type ShiprocketOrderPayload = {
    order_id: string
    order_date: string
    pickup_location: string
    billing_customer_name: string
    billing_last_name: string
    billing_address: string
    billing_city: string
    billing_pincode: string
    billing_state: string
    billing_country: string
    billing_email: string
    billing_phone: string
    shipping_is_billing: boolean
    order_items: Array<{
        name: string
        sku: string
        units: number
        selling_price: number
    }>
    payment_method: "Prepaid" | "COD"
    sub_total: number
    length: number
    breadth: number
    height: number
    weight: number
}

/**
 * ShiprocketService — Logistics integration for Vridhira Marketplace
 *
 * Provides multi-courier access (25+ couriers via Shiprocket aggregator):
 * - Delhivery, Blue Dart, FedEx, DTDC, Ecom Express, etc.
 * - Automatic rate comparison & cheapest courier selection
 * - Real-time tracking
 * - COD remittance tracking
 *
 * Docs: https://apidocs.shiprocket.in/
 */
class ShiprocketService {
    static identifier = "shiprocketService"

    private baseUrl = "https://apiv2.shiprocket.in/v1/external"
    // Static so they persist across different instances of the service
    private static token: string | null = null
    private static tokenExpiry: Date | null = null

    constructor() {
        // plain class — no v1 transactional base needed
    }

    /**
     * Authenticate with Shiprocket and cache the token
     */
    async authenticate(): Promise<string> {
        // Return cached token if still valid (tokens last ~24h)
        if (ShiprocketService.token && ShiprocketService.tokenExpiry && new Date() < ShiprocketService.tokenExpiry) {
            return ShiprocketService.token
        }

        const email = process.env.SHIPROCKET_EMAIL
        const password = process.env.SHIPROCKET_PASSWORD

        if (!email || !password) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD must be set in .env"
            )
        }

        const response = await fetch(`${this.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        })

        if (!response.ok) {
            throw new MedusaError(
                MedusaError.Types.UNEXPECTED_STATE,
                `Shiprocket authentication failed: ${response.statusText}`
            )
        }

        const data = (await response.json()) as ShiprocketAuthResponse
        ShiprocketService.token = data.token
        // Token expires in 24 hours — refresh 1 hour early
        ShiprocketService.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000)

        return ShiprocketService.token
    }

    /**
     * Get auth headers for API requests
     */
    private async getHeaders(): Promise<Record<string, string>> {
        const token = await this.authenticate()
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        }
    }

    /**
     * Check if a pincode is serviceable and get available couriers with rates
     */
    async checkServiceability(
        pincode: string,
        weight: number = 0.5,
        cod: boolean = false
    ): Promise<ServiceabilityResponse["data"]> {
        const headers = await this.getHeaders()

        const params = new URLSearchParams({
            pickup_postcode: process.env.SHIPROCKET_PICKUP_POSTCODE || "110001",
            delivery_postcode: pincode,
            weight: weight.toString(),
            cod: cod ? "1" : "0",
        })

        const response = await fetch(
            `${this.baseUrl}/courier/serviceability/?${params}`,
            { headers }
        )

        if (!response.ok) {
            throw new MedusaError(
                MedusaError.Types.UNEXPECTED_STATE,
                `Shiprocket serviceability check failed: ${response.statusText}`
            )
        }

        const data = (await response.json()) as ServiceabilityResponse
        return data.data
    }

    /**
     * Create a shipment order in Shiprocket
     */
    async createOrder(payload: ShiprocketOrderPayload): Promise<{
        order_id: number
        shipment_id: number
        status: string
        awb_code?: string
    }> {
        const headers = await this.getHeaders()

        const response = await fetch(`${this.baseUrl}/orders/create/adhoc`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new MedusaError(
                MedusaError.Types.UNEXPECTED_STATE,
                `Shiprocket order creation failed: ${JSON.stringify(error)}`
            )
        }

        return response.json()
    }

    /**
     * Generate AWB (Air Waybill) number for a shipment
     */
    async generateAWB(
        shipmentId: number,
        courierId?: number
    ): Promise<{ awb_code: string; courier_name: string }> {
        const headers = await this.getHeaders()

        const body: Record<string, unknown> = { shipment_id: [shipmentId] }
        if (courierId) body.courier_id = courierId

        const response = await fetch(`${this.baseUrl}/courier/assign/awb`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            throw new MedusaError(
                MedusaError.Types.UNEXPECTED_STATE,
                `AWB generation failed: ${response.statusText}`
            )
        }

        const data = await response.json()
        return {
            awb_code: data.response?.data?.awb_code,
            courier_name: data.response?.data?.courier_name,
        }
    }

    /**
     * Schedule a pickup for shipments
     */
    async schedulePickup(shipmentIds: number[]): Promise<{ pickup_scheduled: boolean }> {
        const headers = await this.getHeaders()

        const response = await fetch(`${this.baseUrl}/courier/generate/pickup`, {
            method: "POST",
            headers,
            body: JSON.stringify({ shipment_id: shipmentIds }),
        })

        if (!response.ok) {
            throw new MedusaError(
                MedusaError.Types.UNEXPECTED_STATE,
                `Pickup scheduling failed: ${response.statusText}`
            )
        }

        return { pickup_scheduled: true }
    }

    /**
     * Track a shipment by AWB number
     */
    async trackShipment(awbCode: string): Promise<{
        current_status: string
        delivered_date?: string
        etd?: string
        tracking_data: unknown
    }> {
        const headers = await this.getHeaders()

        const response = await fetch(
            `${this.baseUrl}/courier/track/awb/${awbCode}`,
            { headers }
        )

        if (!response.ok) {
            throw new MedusaError(
                MedusaError.Types.NOT_FOUND,
                `Shipment tracking failed for AWB ${awbCode}: ${response.statusText}`
            )
        }

        const data = await response.json()
        return {
            current_status: data.tracking_data?.track_status,
            delivered_date: data.tracking_data?.delivered_date,
            etd: data.tracking_data?.etd,
            tracking_data: data.tracking_data,
        }
    }

    /**
     * Cancel a shipment
     */
    async cancelShipment(awbCodes: string[]): Promise<{ cancelled: boolean }> {
        const headers = await this.getHeaders()

        const response = await fetch(`${this.baseUrl}/orders/cancel/shipment/awbs`, {
            method: "POST",
            headers,
            body: JSON.stringify({ awbs: awbCodes }),
        })

        if (!response.ok) {
            throw new MedusaError(
                MedusaError.Types.UNEXPECTED_STATE,
                `Shipment cancellation failed: ${response.statusText}`
            )
        }

        return { cancelled: true }
    }

    /**
     * Get shipping rates for a given route and weight
     */
    async getShippingRates(
        deliveryPincode: string,
        weight: number = 0.5,
        cod: boolean = false
    ): Promise<Array<{ courier: string; rate: number; etd: number }>> {
        const serviceability = await this.checkServiceability(deliveryPincode, weight, cod)

        return (serviceability?.available_courier_companies ?? [])
            .map((c) => ({
                courier: c.courier_name,
                rate: c.rate,
                etd: c.estimated_delivery_days,
            }))
            .sort((a, b) => a.rate - b.rate) // cheapest first
    }

    // ── COD Remittance ────────────────────────────────────────────────────────

    /**
     * List COD remittance batches from Shiprocket.
     *
     * Shiprocket collects cash from couriers and batches deposits to your bank
     * account (typically T+7 working days). This endpoint surfaces each batch.
     *
     * Docs: https://apidocs.shiprocket.in/#remittance
     *
     * @param params.from       Start date YYYY-MM-DD (default: 90 days ago)
     * @param params.to         End date YYYY-MM-DD (default: today)
     * @param params.page       Page number (default: 1)
     * @param params.per_page   Items per page (default: 25, max: 100)
     */
    async getRemittances(params?: {
        from?: string
        to?: string
        page?: number
        per_page?: number
    }): Promise<RemittanceListResult> {
        const headers = await this.getHeaders()

        const to   = params?.to   ?? new Date().toISOString().slice(0, 10)
        const from = params?.from ?? this.daysAgo(90)
        const page     = params?.page     ?? 1
        const per_page = params?.per_page ?? 25

        const qs = new URLSearchParams({
            from_date: from,
            to_date:   to,
            page:      String(page),
            per_page:  String(per_page),
        })

        const response = await fetch(`${this.baseUrl}/remittance?${qs}`, { headers })

        if (!response.ok) {
            throw new MedusaError(
                MedusaError.Types.UNEXPECTED_STATE,
                `Shiprocket remittance API failed: ${response.status} ${response.statusText}`
            )
        }

        const body = await response.json() as any

        // Normalize Shiprocket's nested response structure
        const raw: any[]         = body?.data?.data ?? []
        const pagination: any    = body?.data?.meta?.pagination ?? {}

        const entries: RemittanceEntry[] = raw.map((r: any) => ({
            id:                r.id,
            date:              r.date ?? r.created_at,
            transaction_id:    r.transaction_id ?? String(r.id),
            amount:            Number(r.amount ?? 0),
            debit_credit_flag: r.debit_credit_flag ?? "",
            awbs:              r.awbs ?? "",
            orders:            r.orders ?? "",
            // Shiprocket returns status as numeric codes:
            // 0 = PENDING, 1 = REMITTED, 2 = NOT_REMITTED
            status: this.normalizeRemittanceStatus(r.status),
            remittance_date:   r.remittance_date ?? r.payment_date ?? undefined,
            utr:               r.utr ?? r.transaction_ref ?? undefined,
        }))

        return {
            entries,
            total:       Number(pagination.total      ?? raw.length),
            page:        Number(pagination.current_page ?? page),
            total_pages: Number(pagination.total_pages  ?? 1),
            per_page:    Number(pagination.per_page     ?? per_page),
        }
    }

    /**
     * Aggregated summary of COD remittance health.
     * Fetches up to 90 days of data and computes pending vs remitted totals.
     * Designed for the admin dashboard "at a glance" card.
     */
    async getRemittanceSummary(): Promise<RemittanceSummary> {
        const to       = new Date()
        const from90   = this.daysAgo(90, to)
        const from30   = this.daysAgo(30, to)
        const toStr    = to.toISOString().slice(0, 10)

        // Fetch up to 200 entries across the 90-day window (handles most merchants)
        const result = await this.getRemittances({
            from:     from90,
            to:       toStr,
            per_page: 100,
            page:     1,
        })

        // If there are more pages, fetch them all (unlikely for most merchants in 90 days)
        let all = [...result.entries]
        if (result.total_pages > 1) {
            const extras = await Promise.all(
                Array.from({ length: result.total_pages - 1 }, (_, i) =>
                    this.getRemittances({ from: from90, to: toStr, per_page: 100, page: i + 2 })
                        .then(r => r.entries)
                        .catch(() => [] as RemittanceEntry[])
                )
            )
            all = all.concat(extras.flat())
        }

        const pending   = all.filter(e => e.status === "PENDING")
        const remitted  = all.filter(e => e.status === "REMITTED")

        const remitted30 = remitted.filter(e => {
            if (!e.remittance_date) return false
            // Normalise to YYYY-MM-DD before comparing so the filter is format-agnostic.
            // Shiprocket may return ISO strings ("2026-02-15"), timestamps, or DD/MM/YYYY.
            try {
                const d = new Date(e.remittance_date)
                if (isNaN(d.getTime())) return false
                return d.toISOString().slice(0, 10) >= from30
            } catch {
                return false
            }
        })

        // Most recent remittance — sort descending by parsed date
        const sortedRemitted = remitted
            .filter(e => e.remittance_date)
            .sort((a, b) => {
                const da = new Date(a.remittance_date!).getTime()
                const db = new Date(b.remittance_date!).getTime()
                return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da)
            })

        const lastRemittance = sortedRemitted[0]

        return {
            total_pending_amount:         pending.reduce((s, e) => s + e.amount, 0),
            total_remitted_last_30d:      remitted30.reduce((s, e) => s + e.amount, 0),
            total_remitted_last_90d:      remitted.reduce((s, e) => s + e.amount, 0),
            pending_batch_count:          pending.length,
            remitted_batch_count_last_30d: remitted30.length,
            last_remittance_date:         lastRemittance?.remittance_date ?? null,
            last_remittance_amount:       lastRemittance?.amount ?? 0,
            window_from:                  from90,
            window_to:                    toStr,
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private normalizeRemittanceStatus(raw: any): RemittanceStatus {
        if (raw === 1 || raw === "1" || raw === "REMITTED") return "REMITTED"
        if (raw === 2 || raw === "2" || raw === "NOT_REMITTED") return "NOT_REMITTED"
        return "PENDING"
    }

    /** Returns YYYY-MM-DD for N days ago from a given base date (default: now). */
    private daysAgo(n: number, base: Date = new Date()): string {
        const d = new Date(base)
        d.setDate(d.getDate() - n)
        return d.toISOString().slice(0, 10)
    }
}

export default ShiprocketService
