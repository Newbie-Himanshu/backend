import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Badge, Container, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { sdk } from "../lib/sdk"

// ── Quick summary banner that sits above the Orders list ─────────────────────
// Full details are in the "COD Remittance" sidebar page.
//
// Uses the Medusa JS SDK + TanStack Query instead of raw fetch() so that:
//  - Auth session is handled automatically (no manual `credentials: "include"`)
//  - Results are cached for 5 minutes — no re-fetch on every navigation
//  - The query key ["cod-remittance", "summary"] is shared with the full page,
//    so navigating to the page reuses the cached data instantly.

type Summary = {
    total_pending_amount: number
    total_remitted_last_30d: number
    pending_batch_count: number
    last_remittance_date: string | null
}

const inr = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)

const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"

const CodRemittanceWidget = () => {
    const { data, isLoading, error } = useQuery({
        queryKey: ["cod-remittance", "summary"],
        queryFn:  () => sdk.client.fetch<Summary>("/admin/custom/remittance/summary"),
        staleTime: 5 * 60 * 1000, // cache for 5 minutes
        retry:     false,          // don't retry 503 when Shiprocket isn't configured
    })

    // Don't render anything if Shiprocket isn't configured or the fetch failed
    if (error || (!isLoading && !data)) return null

    return (
        <Container className="mb-2">
            <div className="flex items-center justify-between flex-wrap gap-3">
                {/* Label */}
                <Text size="small" weight="plus" className="text-ui-fg-subtle">
                    COD Remittance
                </Text>

                {isLoading ? (
                    <Text size="small" className="text-ui-fg-muted">Loading…</Text>
                ) : data ? (
                    <div className="flex items-center gap-4 flex-wrap">
                        {/* Pending */}
                        <div className="flex items-center gap-1.5">
                            <Badge color="orange" size="xsmall">Pending</Badge>
                            <Text size="small" className="text-ui-fg-base font-medium">
                                {inr(data.total_pending_amount)}
                            </Text>
                            {data.pending_batch_count > 0 && (
                                <Text size="xsmall" className="text-ui-fg-muted">
                                    ({data.pending_batch_count} batch{data.pending_batch_count !== 1 ? "es" : ""})
                                </Text>
                            )}
                        </div>

                        <span className="text-ui-fg-muted select-none">·</span>

                        {/* Remitted last 30 days */}
                        <div className="flex items-center gap-1.5">
                            <Badge color="green" size="xsmall">Remitted (30d)</Badge>
                            <Text size="small" className="text-ui-fg-base font-medium">
                                {inr(data.total_remitted_last_30d)}
                            </Text>
                        </div>

                        <span className="text-ui-fg-muted select-none">·</span>

                        {/* Last remittance date */}
                        <div className="flex items-center gap-1.5">
                            <Text size="xsmall" className="text-ui-fg-muted">Last transfer:</Text>
                            <Text size="small" className="text-ui-fg-subtle">
                                {fmtDate(data.last_remittance_date)}
                            </Text>
                        </div>

                        {/* Client-side SPA navigation — no full page reload */}
                        <Link
                            to="/cod-remittance"
                            className="text-xs text-ui-fg-interactive hover:underline ml-2"
                        >
                            View all →
                        </Link>
                    </div>
                ) : null}
            </div>
        </Container>
    )
}

// Inject above the Orders list table
export const config = defineWidgetConfig({
    zone: "order.list.before",
})

export default CodRemittanceWidget
