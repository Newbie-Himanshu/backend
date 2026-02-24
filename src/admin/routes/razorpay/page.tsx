import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CurrencyDollar } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import {
    HOTKEYS,
    Kbd,
    METHOD_COLOR,
    PaymentsResponse,
    SummaryCard,
    inr,
    todayISO,
    toUnix,
    useRazorpayHotkeys,
} from "../../lib/razorpay-shared"
import { sdk } from "../../lib/sdk"

// ── Overview / Parent page ────────────────────────────────────────────────────
// Child routes (Payments / Settlements / Analytics / Config) are nested under
// this page in the sidebar via Medusa's file-based nested UI route convention:
//   src/admin/routes/razorpay/payments/page.tsx   → /app/razorpay/payments
//   src/admin/routes/razorpay/settlements/page.tsx → /app/razorpay/settlements
//   src/admin/routes/razorpay/analytics/page.tsx   → /app/razorpay/analytics
//   src/admin/routes/razorpay/config/page.tsx      → /app/razorpay/config

const RazorpayOverviewPage = () => {
    useRazorpayHotkeys()
    // Fetch today's snapshot — lightweight, cached 5 min
    const { data, isLoading } = useQuery<PaymentsResponse>({
        queryKey: ["rzp-overview-today"],
        queryFn: () => {
            const qs = new URLSearchParams({
                from: String(toUnix(todayISO)),
                to:   String(toUnix(todayISO) + 86400),
                count: "100",
                skip:  "0",
            })
            return sdk.client.fetch<PaymentsResponse>(`/admin/custom/razorpay?${qs}`)
        },
        staleTime: 5 * 60 * 1000,
        retry: false,
    })

    const summary         = data?.summary
    const methodBreakdown = data?.method_breakdown ?? {}

    const childPages = [
        {
            label: "Payments",
            href:  HOTKEYS.payments.path,
            hotkey: HOTKEYS.payments.keys,
            desc:  "View, search, capture and refund individual payment transactions",
            badge: summary?.pending_captures
                ? { text: `${summary.pending_captures} pending`, color: "orange" as const }
                : null,
        },
        {
            label: "Settlements",
            href:  HOTKEYS.settlements.path,
            hotkey: HOTKEYS.settlements.keys,
            desc:  "Track Razorpay settlement batches and UTR references",
            badge: null,
        },
        {
            label: "Analytics",
            href:  HOTKEYS.analytics.path,
            hotkey: HOTKEYS.analytics.keys,
            desc:  "Success rates, failure alerts, method breakdown and fee analysis",
            badge: null,
        },
        {
            label: "Config",
            href:  HOTKEYS.config.path,
            hotkey: HOTKEYS.config.keys,
            desc:  "Gateway mode, API connectivity, webhook health and payment methods",
            badge: null,
        },
    ]

    return (
        <div className="p-6 flex flex-col gap-6">
            {/* ── Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <div className="flex items-center gap-3">
                        <Heading>Razorpay</Heading>
                        <Kbd className="text-ui-fg-muted">{HOTKEYS.overview.keys}</Kbd>
                    </div>
                    <Text size="small" className="text-ui-fg-subtle mt-1">
                        Today's overview — use the sidebar or cards below to navigate
                    </Text>
                </div>
                <Button
                    variant="secondary"
                    size="small"
                    onClick={() =>
                        window.open("https://dashboard.razorpay.com/", "_blank", "noopener,noreferrer")
                    }
                >
                    Open Razorpay Dashboard ↗
                </Button>
            </div>

            {/* ── Today's summary cards ── */}
            {isLoading ? (
                <Text size="small" className="text-ui-fg-muted">Loading today's stats…</Text>
            ) : summary ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <SummaryCard label="Captured Today"    value={inr(summary.captured_today)} />
                    <SummaryCard label="Refunded Today"    value={inr(summary.refunded_today)} color="text-ui-fg-error" />
                    <SummaryCard
                        label="Pending Captures"
                        value={String(summary.pending_captures)}
                        sub={summary.pending_captures > 0 ? "Require manual action" : "All clear"}
                        color={summary.pending_captures > 0 ? "text-amber-500" : ""}
                    />
                    <SummaryCard label="Payments Today" value={String(data?.total_count ?? 0)} sub="from Razorpay" />
                </div>
            ) : null}

            {/* ── Today's method breakdown ── */}
            {Object.keys(methodBreakdown).length > 0 && (
                <Container>
                    <Heading level="h2" className="mb-3">Today's Payment Methods</Heading>
                    <div className="flex items-center gap-3 flex-wrap">
                        {Object.entries(methodBreakdown).map(([method, count]) => (
                            <div key={method} className="flex items-center gap-1.5">
                                <Badge color={METHOD_COLOR[method] ?? "grey"} size="xsmall">{method}</Badge>
                                <Text size="small" className="text-ui-fg-muted">{count as number}</Text>
                            </div>
                        ))}
                    </div>
                </Container>
            )}

            {/* ── Navigation cards → child routes ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {childPages.map(item => (
                    <button
                        key={item.label}
                        onClick={() => (window.location.href = item.href)}
                        className="border border-ui-border-base rounded-lg p-5 bg-ui-bg-subtle text-left hover:bg-ui-bg-subtle-hover transition-colors flex flex-col gap-2"
                    >
                        <div className="flex items-center gap-2">
                            <Text weight="plus" className="text-ui-fg-base">{item.label}</Text>
                            {item.badge && (
                                <Badge color={item.badge.color} size="xsmall">{item.badge.text}</Badge>
                            )}
                            <Kbd className="ml-auto text-ui-fg-muted">{item.hotkey}</Kbd>
                        </div>
                        <Text size="small" className="text-ui-fg-muted">{item.desc}</Text>
                    </button>
                ))}
            </div>
        </div>
    )
}

export const config = defineRouteConfig({
    label: "Razorpay",
    icon: CurrencyDollar,
})

export const handle = {
    breadcrumb: () => "Razorpay",
}

export default RazorpayOverviewPage
