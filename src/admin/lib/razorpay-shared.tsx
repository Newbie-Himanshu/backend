/**
 * Shared types, helpers, constants and sub-components for all Razorpay admin pages.
 * Import from this file in every razorpay route/widget to avoid duplication.
 */

import {
    Badge,
    Button,
    Kbd,
    Text,
    Heading,
    toast,
} from "@medusajs/ui"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useState, useEffect } from "react"
import { sdk } from "./sdk"

// Re-export Kbd so pages only need one import source
export { Kbd }

// ── Keyboard shortcut definitions ─────────────────────────────────────────────
// Follows Medusa's own G+X two-stroke pattern.
// Safe second keys — confirmed NOT used by Medusa core:
//   G O=Orders  G P=Products  G C=Customers  G T=Inventory
//   G M=Promotions  G S=Settings  G L=Pricelists  G D=Discounts
export const HOTKEYS = {
    overview:    { keys: "G R", path: "/app/razorpay" },
    payments:    { keys: "G 1", path: "/app/razorpay/payments" },
    settlements: { keys: "G 2", path: "/app/razorpay/settlements" },
    analytics:   { keys: "G 3", path: "/app/razorpay/analytics" },
    config:      { keys: "G 4", path: "/app/razorpay/config" },
} as const

/**
 * Registers the Razorpay G+X keyboard shortcuts for the duration the
 * component is mounted. Ignores events fired while focus is inside any
 * input, textarea, select, or contenteditable element so the shortcuts
 * never interfere with typing.
 */
export function useRazorpayHotkeys() {
    useEffect(() => {
        let gPressed = false
        let gTimer: ReturnType<typeof setTimeout> | null = null

        const handler = (e: KeyboardEvent) => {
            // Never steal keystrokes from form elements
            const tag = (e.target as HTMLElement)?.tagName?.toUpperCase()
            if (
                tag === "INPUT" ||
                tag === "TEXTAREA" ||
                tag === "SELECT" ||
                (e.target as HTMLElement)?.isContentEditable
            ) return

            // Step 1 — capture the G prefix
            if (e.key === "g" || e.key === "G") {
                e.preventDefault()
                gPressed = true
                if (gTimer) clearTimeout(gTimer)
                // Expire the prefix after 1.5 s if no follow-up key
                gTimer = setTimeout(() => { gPressed = false }, 1500)
                return
            }

            // Step 2 — act on the follow-up key
            if (gPressed) {
                gPressed = false
                if (gTimer) { clearTimeout(gTimer); gTimer = null }

                const dest: string | undefined = {
                    r: HOTKEYS.overview.path,
                    R: HOTKEYS.overview.path,
                    "1": HOTKEYS.payments.path,
                    "2": HOTKEYS.settlements.path,
                    "3": HOTKEYS.analytics.path,
                    "4": HOTKEYS.config.path,
                }[e.key]

                if (dest) {
                    e.preventDefault()
                    window.location.href = dest
                }
            }
        }

        document.addEventListener("keydown", handler)
        return () => document.removeEventListener("keydown", handler)
    }, [])
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type RzpPayment = {
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

export type PaymentsResponse = {
    payments: RzpPayment[]
    total_count: number
    method_breakdown: Record<string, number>
    summary: {
        captured_today: number
        refunded_today: number
        pending_captures: number
    }
}

export type DetailResponse = {
    payment: RzpPayment
    events: Array<{
        id: string
        name: string
        created_at: number
        source?: string
    }>
}

export type SettlementsResponse = {
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

export type ConfigResponse = {
    configured: boolean
    mode: "test" | "live" | "unknown"
    key_id_masked: string
    account_id: string | null
    webhook_endpoint: string
    webhook_reachable: boolean
    api_connected: boolean
    api_error: string | null
    emi_widget_enabled: boolean
    methods_info: Record<string, { enabled: boolean; note: string }>
}

// ── Date defaults (computed once at module load) ───────────────────────────────

export const todayISO = new Date().toISOString().slice(0, 10)

export const thirtyDaysAgoISO = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
})()

// ── Helpers ───────────────────────────────────────────────────────────────────

export const inr = (paise: number) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(paise / 100)

export const fmtDate = (unix: number | null | undefined) => {
    if (!unix) return "—"
    return new Date(unix * 1000).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

export const toUnix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000)

// ── Color maps ────────────────────────────────────────────────────────────────

export type StatusColor = "green" | "red" | "orange" | "grey" | "blue"

export const STATUS_CFG: Record<RzpPayment["status"], { label: string; color: StatusColor }> = {
    created:    { label: "Created",    color: "grey"   },
    authorized: { label: "Authorized", color: "orange" },
    captured:   { label: "Captured",   color: "green"  },
    refunded:   { label: "Refunded",   color: "grey"   },
    failed:     { label: "Failed",     color: "red"    },
}

export const METHOD_COLOR: Record<string, StatusColor> = {
    card:       "blue",
    upi:        "green",
    netbanking: "orange",
    wallet:     "grey",
    emi:        "orange",
}

// ── SummaryCard ───────────────────────────────────────────────────────────────

export function SummaryCard({ label, value, sub, color }: {
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

// ── CapturePanel ──────────────────────────────────────────────────────────────

export function CapturePanel({ payment, onDone }: {
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

// ── RefundPanel ───────────────────────────────────────────────────────────────

export function RefundPanel({ payment, onDone }: {
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
                body: { amount: Math.round(Number(amount) * 100), speed },
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

// ── PaymentDetailRow ──────────────────────────────────────────────────────────

export function PaymentDetailRow({ paymentId }: { paymentId: string }) {
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
