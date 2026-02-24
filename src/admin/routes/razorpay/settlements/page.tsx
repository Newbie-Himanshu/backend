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
import { useState } from "react"
import {
    HOTKEYS,
    Kbd,
    SettlementsResponse,
    fmtDate,
    inr,
    thirtyDaysAgoISO,
    todayISO,
    toUnix,
    useRazorpayHotkeys,
} from "../../../lib/razorpay-shared"
import { sdk } from "../../../lib/sdk"

const SettlementsPage = () => {
    useRazorpayHotkeys()
    const [from, setFrom] = useState(thirtyDaysAgoISO)
    const [to, setTo] = useState(todayISO)
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
        <div className="p-6 flex flex-col gap-6">
            {/* Page header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <div className="flex items-center gap-3">
                        <Heading>Settlements</Heading>
                        <Kbd className="text-ui-fg-muted">{HOTKEYS.settlements.keys}</Kbd>
                    </div>
                    <Text size="small" className="text-ui-fg-subtle mt-1">
                        Razorpay settlement batches and UTR references
                    </Text>
                </div>
                {data?.summary && (
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <Text size="xsmall" className="text-ui-fg-subtle">Total Settled (batch)</Text>
                            <Text size="small" weight="plus">{inr(data.summary.total_settled)}</Text>
                        </div>
                        <Button
                            variant="secondary"
                            size="small"
                            onClick={() => window.open("https://dashboard.razorpay.com/app/settlements", "_blank", "noopener,noreferrer")}
                        >
                            Open in Razorpay ↗
                        </Button>
                    </div>
                )}
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
                </div>
            </Container>

            {/* Summary cards */}
            {data?.summary && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="border border-ui-border-base rounded-lg p-4 bg-ui-bg-subtle">
                        <Text size="xsmall" className="text-ui-fg-subtle">Total Settled (loaded batch)</Text>
                        <Heading level="h2" className="text-ui-fg-base mt-1">{inr(data.summary.total_settled)}</Heading>
                    </div>
                    <div className="border border-ui-border-base rounded-lg p-4 bg-ui-bg-subtle">
                        <Text size="xsmall" className="text-ui-fg-subtle">Settled Last 30 Days</Text>
                        <Heading level="h2" className="text-ui-fg-base mt-1">{inr(data.summary.settled_last_30d)}</Heading>
                    </div>
                </div>
            )}

            {/* Settlements table */}
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

export const config = defineRouteConfig({
    label: "Settlements",
})

export const handle = {
    breadcrumb: () => "Settlements",
}

export default SettlementsPage
