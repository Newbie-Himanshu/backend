import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminCustomer } from "@medusajs/framework/types"
import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { sdk } from "../lib/sdk"

// ── Types ─────────────────────────────────────────────────────────────────────

type RzpPayment = {
    id: string
    amount: number
    currency: string
    status: "created" | "authorized" | "captured" | "refunded" | "failed"
    method: string
    amount_refunded: number
    email: string | null
    contact: string | null
    order_id: string | null
    created_at: number
    vpa?: string
    bank?: string
    wallet?: string
}

type PaymentsResponse = {
    payments: RzpPayment[]
    total_count: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inr = (paise: number) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(paise / 100)

const fmtDate = (unix: number) =>
    new Date(unix * 1000).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    })

type StatusColor = "green" | "red" | "orange" | "grey" | "blue"

const STATUS_CFG: Record<string, { label: string; color: StatusColor }> = {
    created:    { label: "Created",    color: "grey"   },
    authorized: { label: "Authorized", color: "orange" },
    captured:   { label: "Captured",   color: "green"  },
    refunded:   { label: "Refunded",   color: "grey"   },
    failed:     { label: "Failed",     color: "red"    },
}

const METHOD_COLOR: Record<string, StatusColor> = {
    card:       "blue",
    upi:        "green",
    netbanking: "orange",
    wallet:     "grey",
    emi:        "orange",
}

// ── Widget ────────────────────────────────────────────────────────────────────

const RazorpayCustomerWidget = ({ data: customer }: DetailWidgetProps<AdminCustomer>) => {
    const email = customer.email

    // Search Razorpay payments by this customer's email — uses the existing list route
    const { data, isLoading, error } = useQuery<PaymentsResponse>({
        queryKey: ["rzp-customer-payments", email],
        queryFn: () => {
            const qs = new URLSearchParams({ q: email, count: "10" })
            return sdk.client.fetch<PaymentsResponse>(`/admin/custom/razorpay?${qs}`)
        },
        staleTime: 5 * 60 * 1000,
        retry: false,
        enabled: Boolean(email),
    })

    if (isLoading) return null
    if (error || !data) return null

    const payments = data.payments ?? []

    // Derive unique payment methods used
    const methodsUsed = [...new Set(payments.map(p => p.method).filter(Boolean))]

    // Total captured + total refunded
    const totalCaptured = payments.filter(p => p.status === "captured" || p.status === "refunded")
        .reduce((sum, p) => sum + p.amount, 0)
    const totalRefunded = payments.reduce((sum, p) => sum + (p.amount_refunded ?? 0), 0)

    if (payments.length === 0) {
        return (
            <Container className="divide-y p-0">
                <div className="px-6 py-4">
                    <Heading level="h2">Razorpay Payments</Heading>
                </div>
                <div className="px-6 py-4">
                    <Text size="small" className="text-ui-fg-subtle">
                        No Razorpay payments found for {email}.
                    </Text>
                </div>
            </Container>
        )
    }

    return (
        <Container className="divide-y p-0">
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 py-4">
                <Heading level="h2">Razorpay Payments</Heading>
                <Link to="/razorpay" className="text-xs text-ui-fg-interactive hover:underline">
                    View all →
                </Link>
            </div>

            {/* ── Summary ── */}
            <div className="px-6 py-4">
                <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                        <Text size="xsmall" className="text-ui-fg-subtle">Total Payments</Text>
                        <Text size="small" weight="plus" className="text-ui-fg-base">
                            {payments.length}
                            {data.total_count > payments.length && (
                                <span className="text-ui-fg-muted font-normal">
                                    {" "}(showing {payments.length} of {data.total_count})
                                </span>
                            )}
                        </Text>
                    </div>
                    <div>
                        <Text size="xsmall" className="text-ui-fg-subtle">Total Captured</Text>
                        <Text size="small" weight="plus" className="text-ui-fg-base">
                            {inr(totalCaptured)}
                        </Text>
                    </div>
                    {totalRefunded > 0 && (
                        <div>
                            <Text size="xsmall" className="text-ui-fg-subtle">Total Refunded</Text>
                            <Text size="small" weight="plus" className="text-ui-fg-error">
                                −{inr(totalRefunded)}
                            </Text>
                        </div>
                    )}
                </div>

                {/* Methods used */}
                {methodsUsed.length > 0 && (
                    <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                        <Text size="xsmall" className="text-ui-fg-subtle">Methods used:</Text>
                        {methodsUsed.map(m => (
                            <Badge key={m} color={METHOD_COLOR[m] ?? "grey"} size="xsmall">
                                {m}
                            </Badge>
                        ))}
                    </div>
                )}

                {/* Payment rows */}
                <div className="flex flex-col divide-y divide-ui-border-base">
                    {payments.map(p => {
                        const cfg = STATUS_CFG[p.status] ?? { label: p.status, color: "grey" as StatusColor }
                        return (
                            <div key={p.id} className="py-2.5 flex items-center gap-4 flex-wrap">
                                <Text size="xsmall" className="text-ui-fg-muted w-24 shrink-0">
                                    {fmtDate(p.created_at)}
                                </Text>
                                <Text size="small" className="text-ui-fg-base font-mono text-xs flex-1 min-w-0 truncate">
                                    {p.id}
                                </Text>
                                <Badge color={METHOD_COLOR[p.method] ?? "grey"} size="xsmall">
                                    {p.method}
                                    {p.vpa ? ` · ${p.vpa}` : ""}
                                    {p.bank ? ` · ${p.bank}` : ""}
                                </Badge>
                                <Text size="small" weight="plus" className="text-ui-fg-base w-20 text-right">
                                    {inr(p.amount)}
                                </Text>
                                <div className="w-20 flex justify-end">
                                    <Badge color={cfg.color} size="xsmall">{cfg.label}</Badge>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </Container>
    )
}

export const config = defineWidgetConfig({
    zone: "customer.details.after",
})

export default RazorpayCustomerWidget
