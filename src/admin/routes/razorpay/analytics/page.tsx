import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
    Badge,
    Container,
    Heading,
    Table,
    Text,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import {
    HOTKEYS,
    Kbd,
    METHOD_COLOR,
    PaymentsResponse,
    inr,
    thirtyDaysAgoISO,
    todayISO,
    toUnix,
    useRazorpayHotkeys,
} from "../../../lib/razorpay-shared"
import { sdk } from "../../../lib/sdk"

const AnalyticsPage = () => {
    useRazorpayHotkeys()
    const [from, setFrom] = useState(thirtyDaysAgoISO)
    const [to, setTo] = useState(todayISO)
    // Load up to 500 payments so analytics are meaningful
    const count = 500

    const { data, isLoading, error } = useQuery<PaymentsResponse>({
        queryKey: ["rzp-analytics-payments", from, to, count],
        queryFn: () => {
            const qs = new URLSearchParams({
                from: String(toUnix(from)),
                to: String(toUnix(to) + 86400),
                count: String(count),
                skip: "0",
            })
            return sdk.client.fetch<PaymentsResponse>(`/admin/custom/razorpay?${qs}`)
        },
        staleTime: 5 * 60 * 1000,
        retry: false,
    })

    const payments = data?.payments ?? []

    return (
        <div className="p-6 flex flex-col gap-6">
            {/* Page header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <div className="flex items-center gap-3">
                        <Heading>Analytics</Heading>
                        <Kbd className="text-ui-fg-muted">{HOTKEYS.analytics.keys}</Kbd>
                    </div>
                    <Text size="small" className="text-ui-fg-subtle mt-1">
                        Success rates, method breakdown and fee analysis across up to {count} payments
                    </Text>
                </div>
            </div>

            {/* Date range filter */}
            <Container>
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Text size="small" className="text-ui-fg-subtle whitespace-nowrap">From</Text>
                        <input
                            type="date"
                            value={from}
                            max={to}
                            onChange={e => setFrom(e.target.value)}
                            className="border border-ui-border-base rounded px-2 py-1 text-sm bg-ui-bg-field text-ui-fg-base"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Text size="small" className="text-ui-fg-subtle whitespace-nowrap">To</Text>
                        <input
                            type="date"
                            value={to}
                            min={from}
                            max={todayISO}
                            onChange={e => setTo(e.target.value)}
                            className="border border-ui-border-base rounded px-2 py-1 text-sm bg-ui-bg-field text-ui-fg-base"
                        />
                    </div>
                    <Text size="xsmall" className="text-ui-fg-muted ml-2">
                        Loaded: {payments.length} payments
                    </Text>
                </div>
            </Container>

            {/* Analytics content */}
            {isLoading ? (
                <Container>
                    <div className="py-8 text-center">
                        <Text className="text-ui-fg-subtle">Loading analytics…</Text>
                    </div>
                </Container>
            ) : error ? (
                <Container>
                    <div className="py-8 text-center">
                        <Text className="text-ui-fg-error">
                            {(error as Error).message || "Failed to load payment data"}
                        </Text>
                    </div>
                </Container>
            ) : payments.length === 0 ? (
                <Container>
                    <div className="py-12 text-center">
                        <Text className="text-ui-fg-subtle">No payment data for the selected range.</Text>
                    </div>
                </Container>
            ) : (() => {
                // ── Computations ──────────────────────────────────────────────────────────

                let totalAttempts   = payments.length
                let successCount    = 0
                let authorizedCount = 0
                let failedCount     = 0
                let createdCount    = 0

                type MethodStat = {
                    captured: number; failed: number; authorized: number
                    total: number; refunded: number; fees: number; tax: number
                }
                const methodStats: Record<string, MethodStat> = {}

                const errorCodes: Record<string, { count: number; sample_desc: string; sample_id: string }> = {}

                let totalFees = 0
                let totalTax  = 0
                let totalNet  = 0

                for (const p of payments) {
                    const m = p.method ?? "other"
                    if (!methodStats[m]) methodStats[m] = { captured: 0, failed: 0, authorized: 0, total: 0, refunded: 0, fees: 0, tax: 0 }

                    if (p.status === "captured" || p.status === "refunded") {
                        successCount++
                        methodStats[m].captured += 1
                        methodStats[m].total    += p.amount
                        methodStats[m].refunded += p.amount_refunded ?? 0
                        methodStats[m].fees     += p.fee ?? 0
                        methodStats[m].tax      += p.tax ?? 0
                        totalFees += p.fee ?? 0
                        totalTax  += p.tax ?? 0
                        totalNet  += p.amount - (p.amount_refunded ?? 0) - (p.fee ?? 0) - (p.tax ?? 0)
                    } else if (p.status === "failed") {
                        failedCount++
                        methodStats[m].failed += 1
                        const code = p.error_code ?? "UNKNOWN"
                        if (!errorCodes[code]) errorCodes[code] = { count: 0, sample_desc: p.error_description ?? "", sample_id: p.id }
                        errorCodes[code].count++
                    } else if (p.status === "authorized") {
                        authorizedCount++
                        methodStats[m].authorized += 1
                    } else {
                        createdCount++
                    }
                }

                const overallSuccessRate = totalAttempts > 0 ? (successCount / totalAttempts) * 100 : 0
                const overallFailureRate = totalAttempts > 0 ? (failedCount / totalAttempts) * 100 : 0

                const HIGH_FAILURE_THRESHOLD     = 10
                const CRITICAL_FAILURE_THRESHOLD = 25
                const isHighFailure     = overallFailureRate >= HIGH_FAILURE_THRESHOLD
                const isCriticalFailure = overallFailureRate >= CRITICAL_FAILURE_THRESHOLD

                const sortedErrors = Object.entries(errorCodes)
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 5)

                const methodRows = Object.entries(methodStats)
                    .sort((a, b) => (b[1].captured + b[1].authorized) - (a[1].captured + a[1].authorized))
                const grandTotal = methodRows.reduce((s, [, v]) => s + v.total, 0)

                return (
                    <>
                        {/* ── Failed Payment Alerts ── */}
                        {(isHighFailure || sortedErrors.length > 0) && (
                            <div className={`rounded-lg border p-4 flex flex-col gap-3 ${
                                isCriticalFailure
                                    ? "border-red-400 bg-red-50"
                                    : "border-amber-300 bg-amber-50"
                            }`}>
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">{isCriticalFailure ? "🔴" : "🟡"}</span>
                                    <Text weight="plus" className={isCriticalFailure ? "text-red-700" : "text-amber-700"}>
                                        {isCriticalFailure
                                            ? `Critical: ${overallFailureRate.toFixed(1)}% payment failure rate`
                                            : isHighFailure
                                            ? `Warning: ${overallFailureRate.toFixed(1)}% payment failure rate`
                                            : "Failed Payment Errors Detected"}
                                    </Text>
                                    <Badge color={isCriticalFailure ? "red" : "orange"} size="xsmall">
                                        {failedCount} failed / {totalAttempts} total
                                    </Badge>
                                </div>

                                {sortedErrors.length > 0 && (
                                    <div className="flex flex-col gap-2">
                                        <Text size="xsmall" weight="plus" className={isCriticalFailure ? "text-red-600" : "text-amber-600"}>
                                            Top error codes:
                                        </Text>
                                        {sortedErrors.map(([code, info]) => (
                                            <div key={code} className="flex items-start gap-3 pl-2">
                                                <Badge color="red" size="xsmall">{code}</Badge>
                                                <Text size="xsmall" className="text-ui-fg-subtle flex-1">
                                                    {info.count}× — {info.sample_desc || "No description"}
                                                    <span className="font-mono ml-1 text-ui-fg-muted">(e.g. {info.sample_id})</span>
                                                </Text>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <Text size="xsmall" className={isCriticalFailure ? "text-red-500" : "text-amber-500"}>
                                    {"Review failed payments or "}
                                    <button
                                        onClick={() => window.open("https://dashboard.razorpay.com/app/payments?status=failed", "_blank", "noopener,noreferrer")}
                                        className="underline hover:no-underline"
                                    >
                                        open Razorpay Dashboard ↗
                                    </button>
                                </Text>
                            </div>
                        )}

                        {/* ── Payment Success Rates ── */}
                        <Container>
                            <div className="mb-4">
                                <Heading level="h2">Payment Success Rates</Heading>
                                <Text size="small" className="text-ui-fg-subtle mt-1">
                                    Gateway health across {totalAttempts} payments in this date range
                                </Text>
                            </div>

                            {/* Progress bar */}
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-1.5">
                                    <Text size="small" weight="plus" className="text-ui-fg-base">Overall success rate</Text>
                                    <Text size="small" weight="plus" className={overallSuccessRate >= 90 ? "text-green-600" : overallSuccessRate >= 75 ? "text-amber-600" : "text-red-600"}>
                                        {overallSuccessRate.toFixed(1)}%
                                    </Text>
                                </div>
                                <div className="h-3 rounded-full bg-ui-bg-subtle overflow-hidden flex">
                                    <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${overallSuccessRate}%` }} />
                                    {authorizedCount > 0 && (
                                        <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${(authorizedCount / totalAttempts) * 100}%` }} />
                                    )}
                                    <div className="h-full bg-red-400 transition-all duration-500" style={{ width: `${overallFailureRate}%` }} />
                                </div>
                                <div className="flex gap-4 mt-2 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                                        <Text size="xsmall" className="text-ui-fg-subtle">Captured/Refunded: {successCount}</Text>
                                    </div>
                                    {authorizedCount > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                            <Text size="xsmall" className="text-ui-fg-subtle">Authorized (pending): {authorizedCount}</Text>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                                        <Text size="xsmall" className="text-ui-fg-subtle">Failed: {failedCount} ({overallFailureRate.toFixed(1)}%)</Text>
                                    </div>
                                    {createdCount > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full bg-ui-fg-muted" />
                                            <Text size="xsmall" className="text-ui-fg-subtle">Created: {createdCount}</Text>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Stat cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="border border-ui-border-base rounded-lg p-4 bg-ui-bg-subtle">
                                    <Text size="xsmall" className="text-ui-fg-subtle">Success Rate</Text>
                                    <Heading level="h2" className={`mt-1 ${overallSuccessRate >= 90 ? "text-green-600" : overallSuccessRate >= 75 ? "text-amber-600" : "text-red-600"}`}>
                                        {overallSuccessRate.toFixed(1)}%
                                    </Heading>
                                </div>
                                <div className="border border-ui-border-base rounded-lg p-4 bg-ui-bg-subtle">
                                    <Text size="xsmall" className="text-ui-fg-subtle">Failure Rate</Text>
                                    <Heading level="h2" className={`mt-1 ${overallFailureRate < 5 ? "text-ui-fg-base" : overallFailureRate < 15 ? "text-amber-600" : "text-red-600"}`}>
                                        {overallFailureRate.toFixed(1)}%
                                    </Heading>
                                </div>
                                <div className="border border-ui-border-base rounded-lg p-4 bg-ui-bg-subtle">
                                    <Text size="xsmall" className="text-ui-fg-subtle">Successful</Text>
                                    <Heading level="h2" className="text-ui-fg-base mt-1">{successCount}</Heading>
                                    <Text size="xsmall" className="text-ui-fg-muted mt-0.5">of {totalAttempts} total</Text>
                                </div>
                                <div className="border border-ui-border-base rounded-lg p-4 bg-ui-bg-subtle">
                                    <Text size="xsmall" className="text-ui-fg-subtle">Failed</Text>
                                    <Heading level="h2" className={`mt-1 ${failedCount === 0 ? "text-ui-fg-base" : "text-red-600"}`}>
                                        {failedCount}
                                    </Heading>
                                    {failedCount > 0 && (
                                        <Text size="xsmall" className="text-ui-fg-muted mt-0.5">
                                            {sortedErrors.length} distinct error{sortedErrors.length !== 1 ? "s" : ""}
                                        </Text>
                                    )}
                                </div>
                            </div>
                        </Container>

                        {/* ── Method Breakdown ── */}
                        <Container>
                            <div className="mb-4">
                                <Heading level="h2">Payment Method Breakdown</Heading>
                                <Text size="small" className="text-ui-fg-subtle mt-1">
                                    Usage frequency and success/failure rates by payment method
                                </Text>
                            </div>
                            <Table>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.HeaderCell>Method</Table.HeaderCell>
                                        <Table.HeaderCell>Attempts</Table.HeaderCell>
                                        <Table.HeaderCell>Success Rate</Table.HeaderCell>
                                        <Table.HeaderCell>Captured</Table.HeaderCell>
                                        <Table.HeaderCell>Failed</Table.HeaderCell>
                                        <Table.HeaderCell>Gross Revenue</Table.HeaderCell>
                                        <Table.HeaderCell>Net Revenue</Table.HeaderCell>
                                        <Table.HeaderCell>Volume Share</Table.HeaderCell>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {methodRows.map(([method, s]) => {
                                        const methodAttempts = s.captured + s.failed + s.authorized
                                        const methodSuccessRate = methodAttempts > 0 ? (s.captured / methodAttempts) * 100 : 0
                                        const net = s.total - s.refunded
                                        const volPct = grandTotal > 0 ? (s.total / grandTotal) * 100 : 0
                                        const rateColor = methodSuccessRate >= 90 ? "text-green-600"
                                            : methodSuccessRate >= 75 ? "text-amber-600"
                                            : "text-red-600"
                                        return (
                                            <Table.Row key={method}>
                                                <Table.Cell>
                                                    <Badge color={METHOD_COLOR[method] ?? "grey"} size="xsmall">{method}</Badge>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <Text size="small">{methodAttempts}</Text>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <div className="flex flex-col gap-1">
                                                        <Text size="small" weight="plus" className={rateColor}>
                                                            {methodAttempts > 0 ? `${methodSuccessRate.toFixed(0)}%` : "—"}
                                                        </Text>
                                                        {methodAttempts > 0 && (
                                                            <div className="h-1.5 w-20 rounded-full bg-ui-bg-subtle overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full ${methodSuccessRate >= 90 ? "bg-green-500" : methodSuccessRate >= 75 ? "bg-amber-400" : "bg-red-400"}`}
                                                                    style={{ width: `${methodSuccessRate}%` }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <Text size="small" className="text-green-600">{s.captured}</Text>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <Text size="small" className={s.failed > 0 ? "text-red-600" : "text-ui-fg-muted"}>
                                                        {s.failed > 0 ? s.failed : "—"}
                                                    </Text>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <Text size="small" weight="plus">{inr(s.total)}</Text>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <Text size="small" weight="plus" className="text-ui-fg-interactive">{inr(net)}</Text>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="h-2 rounded-full bg-ui-bg-interactive"
                                                            style={{ width: `${volPct}%`, minWidth: volPct > 0 ? 4 : 0, maxWidth: 80 }}
                                                        />
                                                        <Text size="xsmall" className="text-ui-fg-muted">{volPct.toFixed(1)}%</Text>
                                                    </div>
                                                </Table.Cell>
                                            </Table.Row>
                                        )
                                    })}
                                </Table.Body>
                            </Table>
                        </Container>

                        {/* ── Transaction Fees ── */}
                        <Container>
                            <div className="mb-4">
                                <Heading level="h2">Transaction Fees Summary</Heading>
                                <Text size="small" className="text-ui-fg-subtle mt-1">
                                    Platform fees and GST deducted by Razorpay for captured payments in this date range
                                </Text>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="border border-ui-border-base rounded-lg p-4 bg-ui-bg-subtle">
                                    <Text size="xsmall" className="text-ui-fg-subtle">Razorpay Fees</Text>
                                    <Heading level="h2" className="text-ui-fg-base mt-1">{inr(totalFees)}</Heading>
                                </div>
                                <div className="border border-ui-border-base rounded-lg p-4 bg-ui-bg-subtle">
                                    <Text size="xsmall" className="text-ui-fg-subtle">GST on Fees</Text>
                                    <Heading level="h2" className="text-ui-fg-base mt-1">{inr(totalTax)}</Heading>
                                </div>
                                <div className="border border-ui-border-base rounded-lg p-4 bg-ui-bg-subtle">
                                    <Text size="xsmall" className="text-ui-fg-subtle">Total Deducted</Text>
                                    <Heading level="h2" className="text-ui-fg-base mt-1">{inr(totalFees + totalTax)}</Heading>
                                </div>
                                <div className="border border-ui-border-base rounded-lg p-4 bg-ui-bg-subtle">
                                    <Text size="xsmall" className="text-ui-fg-subtle">Net Revenue (estimate)</Text>
                                    <Heading level="h2" className="text-ui-fg-interactive mt-1">{inr(totalNet)}</Heading>
                                    <Text size="xsmall" className="text-ui-fg-muted mt-0.5">gross − refunds − fees − GST</Text>
                                </div>
                            </div>
                            <Text size="xsmall" className="text-ui-fg-muted mt-3">
                                * Fee data is only available for payments already settled or with fee details from Razorpay.
                            </Text>
                        </Container>
                    </>
                )
            })()}
        </div>
    )
}

export const config = defineRouteConfig({
    label: "Analytics",
    rank: 0,
})

export const handle = {
    breadcrumb: () => "Analytics",
}

export default AnalyticsPage
