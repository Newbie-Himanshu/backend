import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CurrencyDollar } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Table, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../../lib/sdk"

// â”€â”€ Types (mirror the backend) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type RemittanceStatus = "PENDING" | "REMITTED" | "NOT_REMITTED"

type RemittanceEntry = {
    id: number
    date: string
    transaction_id: string
    amount: number
    status: RemittanceStatus
    remittance_date?: string
    utr?: string
    awbs: string
    orders: string
}

type RemittanceList = {
    entries: RemittanceEntry[]
    total: number
    page: number
    total_pages: number
    per_page: number
}

type RemittanceSummary = {
    total_pending_amount: number
    total_remitted_last_30d: number
    total_remitted_last_90d: number
    pending_batch_count: number
    remitted_batch_count_last_30d: number
    last_remittance_date: string | null
    last_remittance_amount: number
    window_from: string
    window_to: string
}

// â”€â”€ Module-level date defaults (computed once at load, not every render) â”€â”€â”€â”€â”€â”€
const todayISO = new Date().toISOString().slice(0, 10)
const ninetyDaysAgoISO = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    return d.toISOString().slice(0, 10)
})()

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const inr = (paise: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise)

const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "â€”"

const statusBadge = (s: RemittanceStatus) => {
    if (s === "REMITTED")     return <Badge color="green">Remitted</Badge>
    if (s === "NOT_REMITTED") return <Badge color="red">Not Remitted</Badge>
    return <Badge color="orange">Pending</Badge>
}

// â”€â”€ Summary Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="border border-ui-border-base rounded-lg p-4 flex flex-col gap-1 bg-ui-bg-subtle">
            <Text size="small" className="text-ui-fg-subtle">{label}</Text>
            <Heading level="h2" className="text-ui-fg-base">{value}</Heading>
            {sub && <Text size="xsmall" className="text-ui-fg-muted">{sub}</Text>}
        </div>
    )
}

// â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CodRemittancePage = () => {
    const [page, setPage] = useState(1)
    const [from, setFrom] = useState(ninetyDaysAgoISO)
    const [to, setTo]     = useState(todayISO)

    // â”€â”€ Summary query (cached 5 min, shared query key with the widget) â”€â”€â”€â”€â”€â”€â”€â”€
    const {
        data: summary,
        isLoading: summaryLoading,
        error: summaryError,
    } = useQuery({
        queryKey: ["cod-remittance", "summary"],
        queryFn:  () => sdk.client.fetch<RemittanceSummary>("/admin/custom/remittance/summary"),
        staleTime: 5 * 60 * 1000,
        retry: false,
    })

    // â”€â”€ List query (re-fetches when from/to/page change) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const {
        data: list,
        isLoading: listLoading,
        error: listError,
    } = useQuery({
        queryKey: ["cod-remittance", "list", from, to, page],
        queryFn: () => {
            const qs = new URLSearchParams({ from, to, page: String(page), per_page: "25" })
            return sdk.client.fetch<RemittanceList>(`/admin/custom/remittance?${qs}`)
        },
        staleTime: 2 * 60 * 1000,
        retry: false,
    })

    if (summaryLoading) {
        return (
            <div className="p-6 flex items-center justify-center">
                <Text className="text-ui-fg-subtle">Loading remittance dataâ€¦</Text>
            </div>
        )
    }

    if (summaryError) {
        return (
            <div className="p-6">
                <Container>
                    <Heading>COD Remittance</Heading>
                    <div className="mt-4 p-4 rounded-lg bg-ui-bg-subtle-hover border border-ui-border-error">
                        <Text className="text-ui-fg-error">
                            {(summaryError as Error).message || "Failed to load remittance data."}
                        </Text>
                        <Text size="small" className="text-ui-fg-muted mt-1">
                            Make sure SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD are configured.
                        </Text>
                    </div>
                </Container>
            </div>
        )
    }

    return (
        <div className="p-6 flex flex-col gap-6">
            {/* â”€â”€ Page Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="flex items-center justify-between">
                <div>
                    <Heading>COD Remittance</Heading>
                    <Text size="small" className="text-ui-fg-subtle mt-1">
                        Cash collected by Shiprocket couriers Â· T+7 working days to your bank
                    </Text>
                </div>
                <Button
                    variant="secondary"
                    size="small"
                    onClick={() => window.open("https://app.shiprocket.in/remittance", "_blank", "noopener,noreferrer")}
                >
                    Open Shiprocket Dashboard â†—
                </Button>
            </div>

            {/* â”€â”€ Summary Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {summary && (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <SummaryCard
                        label="Pending (not yet in bank)"
                        value={inr(summary.total_pending_amount)}
                        sub={`${summary.pending_batch_count} batch${summary.pending_batch_count !== 1 ? "es" : ""}`}
                    />
                    <SummaryCard
                        label="Remitted â€” last 30 days"
                        value={inr(summary.total_remitted_last_30d)}
                        sub={`${summary.remitted_batch_count_last_30d} batches`}
                    />
                    <SummaryCard
                        label="Remitted â€” last 90 days"
                        value={inr(summary.total_remitted_last_90d)}
                    />
                    <SummaryCard
                        label="Last remittance"
                        value={summary.last_remittance_date ? inr(summary.last_remittance_amount) : "â€”"}
                        sub={fmtDate(summary.last_remittance_date)}
                    />
                </div>
            )}

            {/* â”€â”€ Filters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                    {list && (
                        <Text size="small" className="text-ui-fg-muted ml-auto">
                            {list.total} total batches
                        </Text>
                    )}
                </div>
            </Container>

            {/* â”€â”€ Remittance Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <Container className="overflow-x-auto">
                {listLoading ? (
                    <div className="py-8 text-center">
                        <Text className="text-ui-fg-subtle">Loadingâ€¦</Text>
                    </div>
                ) : listError ? (
                    <div className="py-8 text-center">
                        <Text className="text-ui-fg-error">
                            {(listError as Error).message || "Failed to load remittance list."}
                        </Text>
                    </div>
                ) : list && list.entries.length > 0 ? (
                    <>
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.HeaderCell>Date</Table.HeaderCell>
                                    <Table.HeaderCell>Transaction ID</Table.HeaderCell>
                                    <Table.HeaderCell>Amount</Table.HeaderCell>
                                    <Table.HeaderCell>Status</Table.HeaderCell>
                                    <Table.HeaderCell>Remittance Date</Table.HeaderCell>
                                    <Table.HeaderCell>UTR</Table.HeaderCell>
                                    <Table.HeaderCell>Orders</Table.HeaderCell>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {list.entries.map(e => (
                                    <Table.Row key={e.id}>
                                        <Table.Cell>{fmtDate(e.date)}</Table.Cell>
                                        <Table.Cell>
                                            <Text size="small" className="font-mono">{e.transaction_id}</Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Text className="font-medium">{inr(e.amount)}</Text>
                                        </Table.Cell>
                                        <Table.Cell>{statusBadge(e.status)}</Table.Cell>
                                        <Table.Cell>{fmtDate(e.remittance_date)}</Table.Cell>
                                        <Table.Cell>
                                            <Text size="small" className="font-mono">{e.utr ?? "â€”"}</Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Text size="small" className="text-ui-fg-subtle">
                                                {e.orders
                                                    ? e.orders.split(",").length === 1
                                                        ? `#${e.orders}`
                                                        : `${e.orders.split(",").length} orders`
                                                    : "â€”"}
                                            </Text>
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table>

                        {/* Pagination */}
                        {list.total_pages > 1 && (
                            <div className="mt-4 flex items-center justify-between">
                                <Text size="small" className="text-ui-fg-muted">
                                    Page {list.page} of {list.total_pages}
                                </Text>
                                <div className="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        size="small"
                                        disabled={list.page <= 1}
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                    >
                                        â† Prev
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="small"
                                        disabled={list.page >= list.total_pages}
                                        onClick={() => setPage(p => p + 1)}
                                    >
                                        Next â†’
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="py-12 text-center">
                        <Text className="text-ui-fg-subtle">
                            No remittance batches found for the selected date range.
                        </Text>
                    </div>
                )}
            </Container>
        </div>
    )
}

// â”€â”€ Sidebar Link Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const config = defineRouteConfig({
    label: "COD Remittance",
    icon:  CurrencyDollar,
})

// â”€â”€ Breadcrumb â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const handle = {
    breadcrumb: () => "COD Remittance",
}

export default CodRemittancePage
