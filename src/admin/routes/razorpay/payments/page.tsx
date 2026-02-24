import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
    Badge,
    Button,
    Container,
    Heading,
    Table,
    Text,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import {
    CapturePanel,
    HOTKEYS,
    Kbd,
    METHOD_COLOR,
    PaymentDetailRow,
    PaymentsResponse,
    RefundPanel,
    STATUS_CFG,
    StatusColor,
    fmtDate,
    inr,
    thirtyDaysAgoISO,
    todayISO,
    toUnix,
    useRazorpayHotkeys,
} from "../../../lib/razorpay-shared"
import { sdk } from "../../../lib/sdk"

const PaymentsPage = () => {
    useRazorpayHotkeys()
    const [from, setFrom] = useState(thirtyDaysAgoISO)
    const [to, setTo] = useState(todayISO)
    const [search, setSearch] = useState("")
    const [appliedSearch, setAppliedSearch] = useState("")
    const [page, setPage] = useState(1)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [capturingId, setCapturingId] = useState<string | null>(null)
    const [refundingId, setRefundingId] = useState<string | null>(null)

    const perPage = 25

    const { data, isLoading, error, refetch } = useQuery<PaymentsResponse>({
        queryKey: ["rzp-payments", from, to, page, appliedSearch],
        queryFn: () => {
            const qs = new URLSearchParams({
                from: String(toUnix(from)),
                to: String(toUnix(to) + 86400),
                count: String(perPage),
                skip: String((page - 1) * perPage),
                ...(appliedSearch ? { q: appliedSearch } : {}),
            })
            return sdk.client.fetch<PaymentsResponse>(`/admin/custom/razorpay?${qs}`)
        },
        staleTime: 2 * 60 * 1000,
        retry: false,
    })

    const applySearch = useCallback(() => {
        setAppliedSearch(search)
        setPage(1)
    }, [search])

    const clearSearch = () => {
        setSearch("")
        setAppliedSearch("")
        setPage(1)
    }

    const payments = data?.payments ?? []
    const totalPages = data ? Math.ceil(data.total_count / perPage) : 1

    return (
        <div className="p-6 flex flex-col gap-6">
            {/* Page header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <div className="flex items-center gap-3">
                        <Heading>Payments</Heading>
                        <Kbd className="text-ui-fg-muted">{HOTKEYS.payments.keys}</Kbd>
                    </div>
                    <Text size="small" className="text-ui-fg-subtle mt-1">
                        Search, capture and refund Razorpay payments
                    </Text>
                </div>
                <Button
                    variant="secondary"
                    size="small"
                    onClick={() => window.open("https://dashboard.razorpay.com/app/payments", "_blank", "noopener,noreferrer")}
                >
                    Open in Razorpay ↗
                </Button>
            </div>

            {/* Date range + search */}
            <Container>
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Text size="small" className="text-ui-fg-subtle whitespace-nowrap">From</Text>
                        <input
                            type="date"
                            value={from}
                            max={to}
                            onChange={e => { setFrom(e.target.value); setPage(1) }}
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
                            onChange={e => { setTo(e.target.value); setPage(1) }}
                            className="border border-ui-border-base rounded px-2 py-1 text-sm bg-ui-bg-field text-ui-fg-base"
                        />
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        <input
                            type="text"
                            placeholder="Search by payment ID, email, phone…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") applySearch() }}
                            className="border border-ui-border-base rounded px-3 py-1.5 text-sm bg-ui-bg-field text-ui-fg-base w-72"
                        />
                        <Button variant="secondary" size="small" onClick={applySearch}>Search</Button>
                        {appliedSearch && (
                            <Button variant="transparent" size="small" onClick={clearSearch}>✕ Clear</Button>
                        )}
                    </div>
                </div>
            </Container>

            {/* Payments table */}
            <Container className="overflow-x-auto">
                {isLoading ? (
                    <div className="py-8 text-center">
                        <Text className="text-ui-fg-subtle">Loading payments…</Text>
                    </div>
                ) : error ? (
                    <div className="py-8 text-center">
                        <Text className="text-ui-fg-error">
                            {(error as Error).message || "Failed to load payments."}
                        </Text>
                        <Text size="small" className="text-ui-fg-muted mt-1">
                            Make sure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are configured.
                        </Text>
                    </div>
                ) : payments.length > 0 ? (
                    <>
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.HeaderCell>Date</Table.HeaderCell>
                                    <Table.HeaderCell>Payment ID</Table.HeaderCell>
                                    <Table.HeaderCell>Order ID</Table.HeaderCell>
                                    <Table.HeaderCell>Method</Table.HeaderCell>
                                    <Table.HeaderCell>Amount</Table.HeaderCell>
                                    <Table.HeaderCell>Status</Table.HeaderCell>
                                    <Table.HeaderCell>Actions</Table.HeaderCell>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {payments.map(p => {
                                    const cfg = STATUS_CFG[p.status] ?? { label: p.status, color: "grey" as StatusColor }
                                    const isExpanded = expandedId === p.id
                                    const isCapturing = capturingId === p.id
                                    const isRefunding = refundingId === p.id

                                    return (
                                        <>
                                            <Table.Row
                                                key={p.id}
                                                className="cursor-pointer hover:bg-ui-bg-subtle"
                                                onClick={() => {
                                                    if (!isCapturing && !isRefunding)
                                                        setExpandedId(isExpanded ? null : p.id)
                                                }}
                                            >
                                                <Table.Cell>
                                                    <Text size="small">{fmtDate(p.created_at)}</Text>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <Text size="small" className="font-mono text-ui-fg-interactive">{p.id}</Text>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <Text size="small" className="font-mono text-ui-fg-subtle">{p.order_id ?? "—"}</Text>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <Badge color={METHOD_COLOR[p.method] ?? "grey"} size="xsmall">{p.method}</Badge>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <Text size="small" weight="plus">{inr(p.amount)}</Text>
                                                    {p.amount_refunded > 0 && (
                                                        <Text size="xsmall" className="text-ui-fg-error">
                                                            −{inr(p.amount_refunded)} refunded
                                                        </Text>
                                                    )}
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <Badge color={cfg.color} size="xsmall">{cfg.label}</Badge>
                                                </Table.Cell>
                                                <Table.Cell onClick={e => e.stopPropagation()}>
                                                    <div className="flex gap-2">
                                                        {p.status === "authorized" && (
                                                            <Button
                                                                size="small"
                                                                variant="secondary"
                                                                onClick={() => {
                                                                    setExpandedId(p.id)
                                                                    setCapturingId(isCapturing ? null : p.id)
                                                                    setRefundingId(null)
                                                                }}
                                                            >
                                                                Capture
                                                            </Button>
                                                        )}
                                                        {p.status === "captured" && p.amount_refunded < p.amount && (
                                                            <Button
                                                                size="small"
                                                                variant="secondary"
                                                                onClick={() => {
                                                                    setExpandedId(p.id)
                                                                    setRefundingId(isRefunding ? null : p.id)
                                                                    setCapturingId(null)
                                                                }}
                                                            >
                                                                Refund
                                                            </Button>
                                                        )}
                                                    </div>
                                                </Table.Cell>
                                            </Table.Row>

                                            {/* Capture / Refund panels */}
                                            {isExpanded && (isCapturing || isRefunding) && (
                                                <tr key={`${p.id}-action`}>
                                                    <td colSpan={7} className="p-0 border-0">
                                                        {isCapturing && (
                                                            <CapturePanel
                                                                payment={p}
                                                                onDone={() => {
                                                                    setCapturingId(null)
                                                                    setExpandedId(null)
                                                                    refetch()
                                                                }}
                                                            />
                                                        )}
                                                        {isRefunding && (
                                                            <RefundPanel
                                                                payment={p}
                                                                onDone={() => {
                                                                    setRefundingId(null)
                                                                    setExpandedId(null)
                                                                    refetch()
                                                                }}
                                                            />
                                                        )}
                                                    </td>
                                                </tr>
                                            )}

                                            {/* Expanded detail row */}
                                            {isExpanded && !isCapturing && !isRefunding && (
                                                <tr key={`${p.id}-detail`}>
                                                    <td colSpan={7} className="p-0 border-0">
                                                        <PaymentDetailRow paymentId={p.id} />
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    )
                                })}
                            </Table.Body>
                        </Table>

                        {/* Pagination */}
                        {data && data.total_count > perPage && (
                            <div className="mt-4 flex items-center justify-between">
                                <Text size="small" className="text-ui-fg-muted">
                                    Page {page} of {totalPages} · {data.total_count} total payments
                                </Text>
                                <div className="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        size="small"
                                        disabled={page <= 1}
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                    >
                                        ← Prev
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="small"
                                        disabled={page >= totalPages}
                                        onClick={() => setPage(p => p + 1)}
                                    >
                                        Next →
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="py-12 text-center">
                        <Text className="text-ui-fg-subtle">
                            {appliedSearch
                                ? `No payments found matching "${appliedSearch}".`
                                : "No payments found for the selected date range."}
                        </Text>
                    </div>
                )}
            </Container>
        </div>
    )
}

export const config = defineRouteConfig({
    label: "Payments",
    rank: 2,
})

export const handle = {
    breadcrumb: () => "Payments",
}

export default PaymentsPage
