import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Badge, Container, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { sdk } from "../lib/sdk"

type SummaryData = {
    summary: {
        captured_today: number
        refunded_today: number
        pending_captures: number
    }
    total_count: number
}

const inr = (paise: number) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(paise / 100)

// Build a "today only" query: from = start of today, to = now (Unix seconds)
function todayRange(): { from: string; to: string; count: string } {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const from = String(Math.floor(today.getTime() / 1000))
    const to = String(Math.floor(Date.now() / 1000))
    return { from, to, count: "100" }
}

const RazorpaySummaryWidget = () => {
    const range = todayRange()

    const { data, isLoading, error } = useQuery<SummaryData>({
        queryKey: ["rzp-summary-widget"],
        queryFn: () => {
            const qs = new URLSearchParams(range)
            return sdk.client.fetch<SummaryData>(`/admin/custom/razorpay?${qs}`)
        },
        staleTime: 5 * 60 * 1000,
        retry: false,
    })

    if (error || (!isLoading && !data)) return null

    const summary = data?.summary

    return (
        <Container className="mb-2">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <Text size="small" weight="plus" className="text-ui-fg-subtle">
                    Razorpay
                </Text>
                {isLoading ? (
                    <Text size="small" className="text-ui-fg-muted">Loading…</Text>
                ) : summary ? (
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-1.5">
                            <Badge color="green" size="xsmall">Captured Today</Badge>
                            <Text size="small" className="text-ui-fg-base font-medium">
                                {inr(summary.captured_today)}
                            </Text>
                        </div>

                        {summary.refunded_today > 0 && (
                            <>
                                <span className="text-ui-fg-muted select-none">·</span>
                                <div className="flex items-center gap-1.5">
                                    <Badge color="red" size="xsmall">Refunded</Badge>
                                    <Text size="small" className="text-ui-fg-base font-medium">
                                        {inr(summary.refunded_today)}
                                    </Text>
                                </div>
                            </>
                        )}

                        {summary.pending_captures > 0 && (
                            <>
                                <span className="text-ui-fg-muted select-none">·</span>
                                <div className="flex items-center gap-1.5">
                                    <Badge color="orange" size="xsmall">Pending Capture</Badge>
                                    <Text size="small" className="text-ui-fg-base font-medium">
                                        {summary.pending_captures}
                                    </Text>
                                </div>
                            </>
                        )}

                        <span className="text-ui-fg-muted select-none">·</span>
                        <Link
                            to="/razorpay"
                            className="text-xs text-ui-fg-interactive hover:underline ml-2"
                        >
                            View Razorpay →
                        </Link>
                    </div>
                ) : null}
            </div>
        </Container>
    )
}

export const config = defineWidgetConfig({
    zone: "order.list.before",
})

export default RazorpaySummaryWidget
