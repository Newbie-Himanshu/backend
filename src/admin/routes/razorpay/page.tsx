import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CurrencyDollar } from "@medusajs/icons"
import {
    Badge,
    Button,
    Container,
    Heading,
    Table,
    Text,
    toast,
} from "@medusajs/ui"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { sdk } from "../../lib/sdk"

// ── Types ─────────────────────────────────────────────────────────────────────

type RzpPayment = {
    id: string
    entity: string
    amount: number
    currency: string
    status: "created" | "authorized" | "captured" | "refunded" | "failed"
    order_id: string | null
    method: string
    amount_refunded: number
    captured: boolean
    description: string | null
    email: string | null
    contact: string | null
    fee: number | null
    tax: number | null
    error_code: string | null
    error_description: string | null
    created_at: number
    card_id?: string
    bank?: string
    wallet?: string
    vpa?: string
}

type PaymentsResponse = {
    payments: RzpPayment[]
    total_count: number
    method_breakdown: Record<string, number>
    summary: {
        captured_today: number
        refunded_today: number
        pending_captures: number
    }
}

type DetailResponse = {
    payment: RzpPayment
    events: Array<{
        id: string
        name: string
        created_at: number
        source?: string
    }>
}

type SettlementsResponse = {
    settlements: Array<{
        id: string
        entity: string
        amount: number
        status: string
        fees: number
        tax: number
        utr: string | null
        created_at: number
    }>
    total_count: number
    summary: {
        total_settled: number
        settled_last_30d: number
    }
}

// ── Date defaults (computed once at module load) ───────────────────────────────

const todayISO = new Date().toISOString().slice(0, 10)
const thirtyDaysAgoISO = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
})()

// ── Helpers ───────────────────────────────────────────────────────────────────

const inr = (paise: number) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(paise / 100)

const fmtDate = (unix: number | null | undefined) => {
    if (!unix) return "—"
    return new Date(unix * 1000).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

const toUnix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000)

type StatusColor = "green" | "red" | "orange" | "grey" | "blue"

const STATUS_CFG: Record<RzpPayment["status"], { label: string; color: StatusColor }> = {
    created:    { label: "Created",    color: "grey"   },
    authorized: { label: "Authorized", color: "orange" },
    captured:   { label: "Captured",   color: "green"  },
    refunded:   { label: "Refunded",   color: "grey"   },
    failed:     { label: "Failed",     color: "red"    },
}

const METHOD_COLOR: Record<string, StatusColor> = {
    card:        "blue",
    upi:         "green",
    netbanking:  "orange",
    wallet:      "grey",
    emi:         "orange",
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color }: {
    label: string
    value: string
    sub?: string
    color?: string
}) {
    return (
        <div className="border border-ui-border-base rounded-lg p-4 flex flex-col gap-1 bg-ui-bg-subtle">
            <Text size="small" className="text-ui-fg-subtle">{label}</Text>
            <Heading level="h2" className={`text-ui-fg-base ${color ?? ""}`}>{value}</Heading>
            {sub && <Text size="xsmall" className="text-ui-fg-muted">{sub}</Text>}
        </div>
    )
}

// Capture inline form
function CapturePanel({
    payment,
    onDone,
}: {
    payment: RzpPayment
    onDone: () => void
}) {
    const [amount, setAmount] = useState(String(payment.amount / 100))

    const { mutate, isPending } = useMutation({
        mutationFn: () =>
            sdk.client.fetch(`/admin/custom/razorpay/${payment.id}/capture`, {
                method: "POST",
                body: { amount: Math.round(Number(amount) * 100), currency: payment.currency },
            }),
        onSuccess: () => {
            toast.success(`Payment ${payment.id} captured successfully`)
            onDone()
        },
        onError: (err: any) => {
            toast.error(err?.message ?? "Capture failed")
        },
    })

    return (
        <div className="mt-3 p-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle-hover flex flex-col gap-3">
            <Text size="small" weight="plus" className="text-ui-fg-base">Capture Payment</Text>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                    <Text size="small" className="text-ui-fg-subtle">₹</Text>
                    <input
                        type="number"
                        min="1"
                        max={payment.amount / 100}
                        step="0.01"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="border border-ui-border-base rounded px-2 py-1 text-sm bg-ui-bg-field text-ui-fg-base w-32"
                    />
                </div>
                <Text size="xsmall" className="text-ui-fg-muted">
                    Max: {inr(payment.amount)}
                </Text>
            </div>
            <div className="flex gap-2">
                <Button size="small" isLoading={isPending} onClick={() => mutate()}>
                    Capture ₹{amount}
                </Button>
                <Button size="small" variant="secondary" onClick={onDone} disabled={isPending}>
                    Cancel
                </Button>
            </div>
        </div>
    )
}

// Refund inline form
function RefundPanel({
    payment,
    onDone,
}: {
    payment: RzpPayment
    onDone: () => void
}) {
    const maxRefundable = (payment.amount - payment.amount_refunded) / 100
    const [amount, setAmount] = useState(String(maxRefundable.toFixed(2)))
    const [speed, setSpeed] = useState<"normal" | "optimum">("normal")

    const { mutate, isPending } = useMutation({
        mutationFn: () =>
            sdk.client.fetch(`/admin/custom/razorpay/${payment.id}/refund`, {
                method: "POST",
                body: {
                    amount: Math.round(Number(amount) * 100),
                    speed,
                },
            }),
        onSuccess: () => {
            toast.success(`Refund of ₹${amount} initiated for ${payment.id}`)
            onDone()
        },
        onError: (err: any) => {
            toast.error(err?.message ?? "Refund failed")
        },
    })

    return (
        <div className="mt-3 p-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle-hover flex flex-col gap-3">
            <Text size="small" weight="plus" className="text-ui-fg-base">Issue Refund</Text>
            {payment.amount_refunded > 0 && (
                <Text size="xsmall" className="text-ui-fg-muted">
                    Already refunded: {inr(payment.amount_refunded)} · Remaining: {inr(payment.amount - payment.amount_refunded)}
                </Text>
            )}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                    <Text size="small" className="text-ui-fg-subtle">₹</Text>
                    <input
                        type="number"
                        min="1"
                        max={maxRefundable}
                        step="0.01"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="border border-ui-border-base rounded px-2 py-1 text-sm bg-ui-bg-field text-ui-fg-base w-32"
                    />
                </div>
                <div className="flex items-center gap-1.5">
                    <Text size="small" className="text-ui-fg-subtle whitespace-nowrap">Speed</Text>
                    <select
                        value={speed}
                        onChange={e => setSpeed(e.target.value as "normal" | "optimum")}
                        className="border border-ui-border-base rounded px-2 py-1 text-sm bg-ui-bg-field text-ui-fg-base"
                    >
                        <option value="normal">Normal (5-7 days)</option>
                        <option value="optimum">Optimum (instant)</option>
                    </select>
                </div>
            </div>
            <div className="flex gap-2">
                <Button size="small" variant="danger" isLoading={isPending} onClick={() => mutate()}>
                    Refund ₹{amount}
                </Button>
                <Button size="small" variant="secondary" onClick={onDone} disabled={isPending}>
                    Cancel
                </Button>
            </div>
        </div>
    )
}

// Expanded row: payment detail + events
function PaymentDetailRow({ paymentId }: { paymentId: string }) {
    const { data, isLoading, error } = useQuery<DetailResponse>({
        queryKey: ["rzp-payment-detail", paymentId],
        queryFn: () =>
            sdk.client.fetch<DetailResponse>(`/admin/custom/razorpay/${paymentId}`),
        staleTime: 60 * 1000,
        retry: false,
    })

    if (isLoading) {
        return (
            <div className="py-3 px-4">
                <Text size="small" className="text-ui-fg-muted">Loading…</Text>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="py-3 px-4">
                <Text size="small" className="text-ui-fg-error">Failed to load payment details</Text>
            </div>
        )
    }

    const { payment, events } = data

    return (
        <div className="px-4 py-3 bg-ui-bg-subtle border-t border-ui-border-base grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 text-sm">
            {payment.email && (
                <div>
                    <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">Email</Text>
                    <Text size="small" className="text-ui-fg-base">{payment.email}</Text>
                </div>
            )}
            {payment.contact && (
                <div>
                    <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">Phone</Text>
                    <Text size="small" className="text-ui-fg-base font-mono">{payment.contact}</Text>
                </div>
            )}
            {payment.fee !== null && payment.fee !== undefined && (
                <div>
                    <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">Razorpay Fee</Text>
                    <Text size="small" className="text-ui-fg-base">{inr(payment.fee)} + {inr(payment.tax ?? 0)} GST</Text>
                </div>
            )}
            {payment.bank && (
                <div>
                    <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">Bank</Text>
                    <Text size="small" className="text-ui-fg-base">{payment.bank}</Text>
                </div>
            )}
            {payment.vpa && (
                <div>
                    <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">UPI VPA</Text>
                    <Text size="small" className="text-ui-fg-base font-mono">{payment.vpa}</Text>
                </div>
            )}
            {payment.wallet && (
                <div>
                    <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">Wallet</Text>
                    <Text size="small" className="text-ui-fg-base">{payment.wallet}</Text>
                </div>
            )}
            {payment.error_description && (
                <div className="col-span-2 md:col-span-3">
                    <Text size="xsmall" weight="plus" className="text-ui-fg-error">Error</Text>
                    <Text size="small" className="text-ui-fg-error">
                        [{payment.error_code}] {payment.error_description}
                    </Text>
                </div>
            )}
            {/* Event timeline */}
            {events.length > 0 && (
                <div className="col-span-2 md:col-span-3 mt-1">
                    <Text size="xsmall" weight="plus" className="text-ui-fg-subtle mb-2">Event Timeline</Text>
                    <div className="flex flex-col gap-1">
                        {events.map((ev, i) => (
                            <div key={ev.id ?? i} className="flex items-center gap-3">
                                <Text size="xsmall" className="text-ui-fg-muted w-40 shrink-0 font-mono">
                                    {fmtDate(ev.created_at)}
                                </Text>
                                <Badge color="blue" size="xsmall">{ev.name}</Badge>
                                {ev.source && (
                                    <Text size="xsmall" className="text-ui-fg-muted">{ev.source}</Text>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <div className="col-span-2 md:col-span-3 mt-2 flex gap-2">
                <Button
                    size="small"
                    variant="secondary"
                    onClick={() => {
                        navigator.clipboard.writeText(paymentId)
                        toast.success("Payment ID copied")
                    }}
                >
                    Copy ID
                </Button>
                <Button
                    size="small"
                    variant="secondary"
                    onClick={() =>
                        window.open(
                            `https://razorpay.com/support/#raised-by-me/issue?paymentId=${paymentId}`,
                            "_blank",
                            "noopener,noreferrer"
                        )
                    }
                >
                    Raise Support Ticket ↗
                </Button>
            </div>
        </div>
    )
}

// ── Settlements section ────────────────────────────────────────────────────────

function SettlementsSection({ from, to }: { from: string; to: string }) {
    const [page, setPage] = useState(1)
    const perPage = 25

    const { data, isLoading, error } = useQuery<SettlementsResponse>({
        queryKey: ["rzp-settlements", from, to, page],
        queryFn: () => {
            const qs = new URLSearchParams({
                from: String(toUnix(from)),
                to: String(toUnix(to) + 86400),
                count: String(perPage),
                skip: String((page - 1) * perPage),
            })
            return sdk.client.fetch<SettlementsResponse>(`/admin/custom/razorpay/settlements?${qs}`)
        },
        staleTime: 5 * 60 * 1000,
        retry: false,
    })

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <Heading level="h2">Settlements</Heading>
                {data?.summary && (
                    <Text size="small" className="text-ui-fg-subtle">
                        Settled (batch): {inr(data.summary.total_settled)}
                    </Text>
                )}
            </div>

            <Container className="overflow-x-auto">
                {isLoading ? (
                    <div className="py-8 text-center">
                        <Text className="text-ui-fg-subtle">Loading settlements…</Text>
                    </div>
                ) : error ? (
                    <div className="py-8 text-center">
                        <Text className="text-ui-fg-error">
                            {(error as Error).message || "Failed to load settlements"}
                        </Text>
                    </div>
                ) : data && data.settlements.length > 0 ? (
                    <>
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.HeaderCell>Date</Table.HeaderCell>
                                    <Table.HeaderCell>Settlement ID</Table.HeaderCell>
                                    <Table.HeaderCell>Amount</Table.HeaderCell>
                                    <Table.HeaderCell>Fees</Table.HeaderCell>
                                    <Table.HeaderCell>Status</Table.HeaderCell>
                                    <Table.HeaderCell>UTR</Table.HeaderCell>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {data.settlements.map(s => (
                                    <Table.Row key={s.id}>
                                        <Table.Cell>
                                            <Text size="small">{fmtDate(s.created_at)}</Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Text size="small" className="font-mono">{s.id}</Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Text size="small" weight="plus">{inr(s.amount)}</Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Text size="small">{inr(s.fees)}</Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Badge
                                                color={s.status === "processed" ? "green" : "orange"}
                                                size="xsmall"
                                            >
                                                {s.status}
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Text size="small" className="font-mono">{s.utr ?? "—"}</Text>
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table>
                        {data.total_count > perPage && (
                            <div className="mt-4 flex items-center justify-between">
                                <Text size="small" className="text-ui-fg-muted">
                                    Page {page} · {data.total_count} total
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
                                        disabled={data.settlements.length < perPage}
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
                            No settlements found for the selected date range.
                        </Text>
                    </div>
                )}
            </Container>
        </div>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const RazorpayPage = () => {
    const [from, setFrom] = useState(thirtyDaysAgoISO)
    const [to, setTo] = useState(todayISO)
    const [search, setSearch] = useState("")
    const [appliedSearch, setAppliedSearch] = useState("")
    const [page, setPage] = useState(1)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [capturingId, setCapturingId] = useState<string | null>(null)
    const [refundingId, setRefundingId] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<"payments" | "settlements">("payments")

    const perPage = 25

    const queryKey = ["rzp-payments", from, to, page, appliedSearch]

    const { data, isLoading, error, refetch } = useQuery<PaymentsResponse>({
        queryKey,
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
    const methodBreakdown = data?.method_breakdown ?? {}
    const summary = data?.summary

    const totalPages = data ? Math.ceil(data.total_count / perPage) : 1

    return (
        <div className="p-6 flex flex-col gap-6">
            {/* ── Page Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <Heading>Razorpay Payments</Heading>
                    <Text size="small" className="text-ui-fg-subtle mt-1">
                        Manage payments, captures, refunds and settlements
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

            {/* ── Summary Cards ── */}
            {summary && (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <SummaryCard
                        label="Captured Today"
                        value={inr(summary.captured_today)}
                    />
                    <SummaryCard
                        label="Refunded Today"
                        value={inr(summary.refunded_today)}
                        color="text-ui-fg-error"
                    />
                    <SummaryCard
                        label="Pending Captures"
                        value={String(summary.pending_captures)}
                        sub={summary.pending_captures > 0 ? "Require manual action" : "All clear"}
                        color={summary.pending_captures > 0 ? "text-amber-500" : ""}
                    />
                    <SummaryCard
                        label="Payments Loaded"
                        value={String(data?.total_count ?? 0)}
                        sub={`in selected range`}
                    />
                </div>
            )}

            {/* ── Method Breakdown ── */}
            {Object.keys(methodBreakdown).length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    <Text size="small" weight="plus" className="text-ui-fg-subtle">Payment Methods:</Text>
                    {Object.entries(methodBreakdown).map(([method, count]) => (
                        <div key={method} className="flex items-center gap-1">
                            <Badge
                                color={METHOD_COLOR[method] ?? "grey"}
                                size="xsmall"
                            >
                                {method}
                            </Badge>
                            <Text size="xsmall" className="text-ui-fg-muted">{count}</Text>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Filters + Search ── */}
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
                        <Button variant="secondary" size="small" onClick={applySearch}>
                            Search
                        </Button>
                        {appliedSearch && (
                            <Button variant="transparent" size="small" onClick={clearSearch}>
                                ✕ Clear
                            </Button>
                        )}
                    </div>
                </div>
            </Container>

            {/* ── Tab Switcher ── */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab("payments")}
                    className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                        activeTab === "payments"
                            ? "bg-ui-bg-interactive text-ui-fg-on-color"
                            : "bg-ui-bg-subtle text-ui-fg-subtle hover:bg-ui-bg-subtle-hover"
                    }`}
                >
                    Payments
                </button>
                <button
                    onClick={() => setActiveTab("settlements")}
                    className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                        activeTab === "settlements"
                            ? "bg-ui-bg-interactive text-ui-fg-on-color"
                            : "bg-ui-bg-subtle text-ui-fg-subtle hover:bg-ui-bg-subtle-hover"
                    }`}
                >
                    Settlements
                </button>
            </div>

            {/* ── Payments Tab ── */}
            {activeTab === "payments" && (
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
                                                        if (!isCapturing && !isRefunding) {
                                                            setExpandedId(isExpanded ? null : p.id)
                                                        }
                                                    }}
                                                >
                                                    <Table.Cell>
                                                        <Text size="small">{fmtDate(p.created_at)}</Text>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <Text size="small" className="font-mono text-ui-fg-interactive">
                                                            {p.id}
                                                        </Text>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <Text size="small" className="font-mono text-ui-fg-subtle">
                                                            {p.order_id ?? "—"}
                                                        </Text>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <Badge
                                                            color={METHOD_COLOR[p.method] ?? "grey"}
                                                            size="xsmall"
                                                        >
                                                            {p.method}
                                                        </Badge>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <Text size="small" weight="plus">
                                                            {inr(p.amount)}
                                                        </Text>
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

                                                {/* Capture/Refund action panels */}
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
            )}

            {/* ── Settlements Tab ── */}
            {activeTab === "settlements" && (
                <SettlementsSection from={from} to={to} />
            )}
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

export default RazorpayPage
