import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminOrder } from "@medusajs/framework/types"
import { Badge, Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../lib/sdk"

// ── Types ─────────────────────────────────────────────────────────────────────

type RzpPayment = {
    id: string
    amount: number
    currency: string
    status: "created" | "authorized" | "captured" | "refunded" | "failed"
    order_id: string | null
    method: string
    amount_refunded: number
    fee: number | null
    tax: number | null
    email: string | null
    contact: string | null
    error_code: string | null
    error_description: string | null
    created_at: number
    bank?: string
    vpa?: string
    wallet?: string
}

type RzpEvent = {
    id: string
    name: string
    created_at: number
    source?: string
}

type OrderPaymentResponse = {
    is_razorpay: boolean
    payment: RzpPayment | null
    events: RzpEvent[]
    medusa_payment_id: string
    razorpay_payment_id?: string
    note?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inr = (paise: number) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(paise / 100)

const fmtDateTime = (unix: number | null | undefined) => {
    if (!unix) return "—"
    return new Date(unix * 1000).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

type StatusColor = "green" | "red" | "orange" | "grey" | "blue"

const STATUS_CFG: Record<string, { label: string; color: StatusColor }> = {
    created:    { label: "Created",    color: "grey"   },
    authorized: { label: "Authorized", color: "orange" },
    captured:   { label: "Captured",   color: "green"  },
    refunded:   { label: "Refunded",   color: "grey"   },
    failed:     { label: "Failed",     color: "red"    },
}

// ── Capture panel ─────────────────────────────────────────────────────────────

function CapturePanel({ payment, onDone }: { payment: RzpPayment; onDone: () => void }) {
    const [amount, setAmount] = useState(String(payment.amount / 100))

    const { mutate, isPending } = useMutation({
        mutationFn: () =>
            sdk.client.fetch(`/admin/custom/razorpay/${payment.id}/capture`, {
                method: "POST",
                body: { amount: Math.round(Number(amount) * 100), currency: payment.currency },
            }),
        onSuccess: () => {
            toast.success("Payment captured successfully")
            onDone()
        },
        onError: (err: any) => toast.error(err?.message ?? "Capture failed"),
    })

    return (
        <div className="p-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle-hover flex flex-col gap-3">
            <Text size="small" weight="plus" className="text-ui-fg-base">Capture Payment</Text>
            <div className="flex items-center gap-3 flex-wrap">
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
                <Text size="xsmall" className="text-ui-fg-muted">Max: {inr(payment.amount)}</Text>
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

// ── Refund panel ──────────────────────────────────────────────────────────────

function RefundPanel({ payment, onDone }: { payment: RzpPayment; onDone: () => void }) {
    const maxRefundable = (payment.amount - payment.amount_refunded) / 100
    const [amount, setAmount] = useState(String(maxRefundable.toFixed(2)))
    const [speed, setSpeed] = useState<"normal" | "optimum">("normal")

    const { mutate, isPending } = useMutation({
        mutationFn: () =>
            sdk.client.fetch(`/admin/custom/razorpay/${payment.id}/refund`, {
                method: "POST",
                body: { amount: Math.round(Number(amount) * 100), speed },
            }),
        onSuccess: () => {
            toast.success(`Refund of ₹${amount} initiated`)
            onDone()
        },
        onError: (err: any) => toast.error(err?.message ?? "Refund failed"),
    })

    return (
        <div className="p-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle-hover flex flex-col gap-3">
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

// ── Main Widget ───────────────────────────────────────────────────────────────

const RazorpayOrderWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
    const orderId = order.id
    const qc = useQueryClient()

    const [showCapture, setShowCapture] = useState(false)
    const [showRefund, setShowRefund]   = useState(false)
    const [showEvents, setShowEvents]   = useState(false)

    const { data, isLoading, error, refetch } = useQuery<OrderPaymentResponse>({
        queryKey: ["rzp-order-payment", orderId],
        queryFn: () =>
            sdk.client.fetch<OrderPaymentResponse>(`/admin/custom/razorpay/order/${orderId}`),
        staleTime: 30 * 1000,
        retry: false,
    })

    // Don't render anything while loading silently, or if not a Razorpay order
    if (isLoading) return null
    if (!data || !data.is_razorpay) return null

    const payment = data.payment
    const events  = data.events ?? []
    const rzpId   = data.razorpay_payment_id ?? payment?.id

    if (!payment && data.note) {
        return (
            <Container className="divide-y p-0">
                <div className="px-6 py-4">
                    <Heading level="h2">Razorpay</Heading>
                </div>
                <div className="px-6 py-4">
                    <Text size="small" className="text-ui-fg-subtle">{data.note}</Text>
                </div>
            </Container>
        )
    }

    if (!payment) return null

    const cfg = STATUS_CFG[payment.status] ?? { label: payment.status, color: "grey" as StatusColor }
    const canCapture = payment.status === "authorized"
    const canRefund  = payment.status === "captured" && payment.amount_refunded < payment.amount

    const handleActionDone = () => {
        setShowCapture(false)
        setShowRefund(false)
        qc.invalidateQueries({ queryKey: ["rzp-order-payment", orderId] })
        refetch()
    }

    return (
        <Container className="divide-y p-0">
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 py-4">
                <Heading level="h2">Razorpay Payment</Heading>
                <div className="flex items-center gap-2">
                    {canCapture && !showRefund && (
                        <Button
                            variant="secondary"
                            size="small"
                            onClick={() => setShowCapture(v => !v)}
                        >
                            {showCapture ? "Cancel Capture" : "Capture"}
                        </Button>
                    )}
                    {canRefund && !showCapture && (
                        <Button
                            variant="secondary"
                            size="small"
                            onClick={() => setShowRefund(v => !v)}
                        >
                            {showRefund ? "Cancel Refund" : "Refund"}
                        </Button>
                    )}
                    <Button variant="transparent" size="small" onClick={() => refetch()}>
                        ↻ Refresh
                    </Button>
                </div>
            </div>

            {/* ── Payment Details ── */}
            <div className="px-6 py-4">
                {error && (
                    <Text size="small" className="text-ui-fg-error mb-3">
                        Failed to load Razorpay status — showing cached data
                    </Text>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
                    <div>
                        <Text size="small" weight="plus" className="text-ui-fg-subtle mb-1">Status</Text>
                        <Badge color={cfg.color} size="xsmall">{cfg.label}</Badge>
                    </div>
                    <div>
                        <Text size="small" weight="plus" className="text-ui-fg-subtle mb-1">Payment ID</Text>
                        <div className="flex items-center gap-1.5">
                            <Text size="small" className="text-ui-fg-base font-mono">{payment.id}</Text>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(payment.id)
                                    toast.success("Copied")
                                }}
                                className="text-ui-fg-muted hover:text-ui-fg-subtle text-xs"
                                title="Copy payment ID"
                            >
                                ⎘
                            </button>
                        </div>
                    </div>
                    <div>
                        <Text size="small" weight="plus" className="text-ui-fg-subtle mb-1">Amount</Text>
                        <Text size="small" className="text-ui-fg-base font-medium">
                            {inr(payment.amount)}
                            {payment.amount_refunded > 0 && (
                                <span className="text-ui-fg-error ml-1 text-xs">
                                    (−{inr(payment.amount_refunded)} refunded)
                                </span>
                            )}
                        </Text>
                    </div>
                    <div>
                        <Text size="small" weight="plus" className="text-ui-fg-subtle mb-1">Method</Text>
                        <Badge color="blue" size="xsmall">{payment.method}</Badge>
                        {payment.vpa && (
                            <Text size="xsmall" className="text-ui-fg-muted mt-0.5 font-mono">{payment.vpa}</Text>
                        )}
                        {payment.bank && (
                            <Text size="xsmall" className="text-ui-fg-muted mt-0.5">{payment.bank}</Text>
                        )}
                        {payment.wallet && (
                            <Text size="xsmall" className="text-ui-fg-muted mt-0.5">{payment.wallet}</Text>
                        )}
                    </div>
                    {payment.fee !== null && payment.fee !== undefined && (
                        <div>
                            <Text size="small" weight="plus" className="text-ui-fg-subtle mb-1">Platform Fee</Text>
                            <Text size="small" className="text-ui-fg-base">
                                {inr(payment.fee)} + {inr(payment.tax ?? 0)} GST
                            </Text>
                        </div>
                    )}
                    <div>
                        <Text size="small" weight="plus" className="text-ui-fg-subtle mb-1">Created</Text>
                        <Text size="small" className="text-ui-fg-base">{fmtDateTime(payment.created_at)}</Text>
                    </div>

                    {payment.error_description && (
                        <div className="col-span-2 md:col-span-3">
                            <Text size="small" weight="plus" className="text-ui-fg-error mb-1">
                                Error [{payment.error_code}]
                            </Text>
                            <Text size="small" className="text-ui-fg-error">{payment.error_description}</Text>
                        </div>
                    )}
                </div>

                {/* Capture / Refund action panels */}
                {showCapture && (
                    <div className="mt-4">
                        <CapturePanel payment={payment} onDone={handleActionDone} />
                    </div>
                )}
                {showRefund && (
                    <div className="mt-4">
                        <RefundPanel payment={payment} onDone={handleActionDone} />
                    </div>
                )}
            </div>

            {/* ── Event Timeline ── */}
            <div className="px-6 py-4">
                <button
                    onClick={() => setShowEvents(v => !v)}
                    className="flex items-center gap-2 text-sm text-ui-fg-subtle hover:text-ui-fg-base transition-colors"
                >
                    <Text size="small" weight="plus" className="text-ui-fg-subtle">
                        Payment Timeline
                    </Text>
                    <Badge color="grey" size="xsmall">{events.length} events</Badge>
                    <span className="text-ui-fg-muted">{showEvents ? "▲" : "▼"}</span>
                </button>

                {showEvents && (
                    <div className="mt-3 flex flex-col gap-1.5">
                        {events.length === 0 ? (
                            <Text size="small" className="text-ui-fg-muted">No events recorded yet.</Text>
                        ) : (
                            events.map((ev, i) => (
                                <div key={ev.id ?? i} className="flex items-center gap-3 py-1 border-b border-ui-border-base last:border-0">
                                    <Text size="xsmall" className="text-ui-fg-muted w-44 shrink-0 font-mono">
                                        {fmtDateTime(ev.created_at)}
                                    </Text>
                                    <Badge color="blue" size="xsmall">{ev.name}</Badge>
                                    {ev.source && (
                                        <Text size="xsmall" className="text-ui-fg-muted">{ev.source}</Text>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Support link */}
                {rzpId && (
                    <div className="mt-3">
                        <button
                            onClick={() =>
                                window.open(
                                    `https://razorpay.com/support/#raised-by-me/issue?paymentId=${rzpId}`,
                                    "_blank",
                                    "noopener,noreferrer"
                                )
                            }
                            className="text-xs text-ui-fg-interactive hover:underline"
                        >
                            Raise Razorpay Support Ticket ↗
                        </button>
                    </div>
                )}
            </div>
        </Container>
    )
}

export const config = defineWidgetConfig({
    zone: "order.details.after",
})

export default RazorpayOrderWidget
