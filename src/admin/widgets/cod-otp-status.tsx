import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminOrder } from "@medusajs/framework/types"
import { Badge, Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useQuery, useMutation } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"

// ── Types ─────────────────────────────────────────────────────────────────────

type DeliveryStatus = "verified" | "sent" | "failed" | "pending" | "not_required"

type OtpStatus = {
    is_cod: boolean
    otp_required: boolean
    otp_verified: boolean
    delivery_status: DeliveryStatus
    phone_last4: string | null
    expires_at: string | null
    attempts: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
    DeliveryStatus,
    { label: string; color: "green" | "red" | "orange" | "blue" | "grey" }
> = {
    verified:     { label: "Verified",     color: "green"  },
    sent:         { label: "OTP Sent",     color: "blue"   },
    pending:      { label: "Pending",      color: "orange" },
    failed:       { label: "Failed",       color: "red"    },
    not_required: { label: "Not Required", color: "grey"   },
}

const fmtDate = (iso: string | null) =>
    iso
        ? new Date(iso).toLocaleString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
          })
        : "—"

// ── Widget ────────────────────────────────────────────────────────────────────
//
// Injected into order.details.after — receives the full AdminOrder as `data`.
// Uses the Medusa JS SDK + TanStack Query (same pattern as cod-remittance-widget):
//  - Auth session handled automatically — no manual `credentials: "include"`
//  - useQuery for GET, useMutation for POST (per Medusa admin dev tips)
//  - Returns null early for non-COD orders so the zone stays empty

const CodOtpStatusWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
    const orderId = order.id

    // ── Fetch OTP status from custom admin route ──
    const { data: status, isLoading, error, refetch } = useQuery({
        queryKey: ["cod-otp-status", orderId],
        queryFn:  () => sdk.client.fetch<OtpStatus>(`/admin/custom/cod-otp/${orderId}`),
        staleTime: 30 * 1000,
        retry:     false,
    })

    // ── Resend OTP — POST to admin resend route ──
    const { mutate: resend, isPending: resending } = useMutation({
        mutationFn: () =>
            sdk.client.fetch(`/admin/custom/cod-otp/${orderId}/resend`, {
                method: "POST",
            }),
        onSuccess: () => {
            toast.success("OTP resent successfully")
            refetch() // refresh status badge without full-page reload
        },
        onError: (err: any) => {
            toast.error(err?.message ?? "Failed to resend OTP")
        },
    })

    // Don't render at all for non-COD orders or if the route returns an error
    if (!isLoading && (!status || !status.is_cod)) return null

    const cfg = status ? STATUS_CONFIG[status.delivery_status] : null

    return (
        <Container className="divide-y p-0">

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-4">
                <Heading level="h2">COD · OTP Verification</Heading>

                {status?.otp_required && !status.otp_verified && (
                    <Button
                        variant="secondary"
                        size="small"
                        isLoading={resending}
                        disabled={resending}
                        onClick={() => resend()}
                    >
                        Resend OTP
                    </Button>
                )}
            </div>

            {/* ── Body ───────────────────────────────────────────────────── */}
            <div className="px-6 py-4">

                {isLoading && (
                    <Text size="small" className="text-ui-fg-muted">Loading…</Text>
                )}

                {!isLoading && error && (
                    <Text size="small" className="text-ui-fg-subtle">
                        Could not load OTP status
                    </Text>
                )}

                {!isLoading && !error && status && cfg && (
                    <div className="grid grid-cols-2 items-start gap-x-8 gap-y-4">

                        {/* Status */}
                        <div>
                            <Text size="small" weight="plus" className="text-ui-fg-subtle mb-1">
                                Status
                            </Text>
                            <Badge color={cfg.color} size="xsmall">
                                {cfg.label}
                            </Badge>
                        </div>

                        {/* OTP Required */}
                        <div>
                            <Text size="small" weight="plus" className="text-ui-fg-subtle mb-1">
                                OTP Required
                            </Text>
                            <Text size="small" className="text-ui-fg-base font-medium">
                                {status.otp_required ? "Yes (order ≥ ₹3,000)" : "No"}
                            </Text>
                        </div>

                        {/* Sent To */}
                        <div>
                            <Text size="small" weight="plus" className="text-ui-fg-subtle mb-1">
                                Sent To
                            </Text>
                            <Text size="small" className="text-ui-fg-base font-mono">
                                {status.phone_last4 ? `+91 ••••••${status.phone_last4}` : "—"}
                            </Text>
                        </div>

                        {/* Expiry */}
                        <div>
                            <Text size="small" weight="plus" className="text-ui-fg-subtle mb-1">
                                {status.otp_verified ? "Verified At" : "OTP Expires"}
                            </Text>
                            <Text size="small" className="text-ui-fg-base">
                                {fmtDate(status.expires_at)}
                            </Text>
                        </div>

                        {/* Failed attempts — only shown when > 0 */}
                        {status.attempts > 0 && (
                            <div className="col-span-2 flex items-center gap-2">
                                <Text size="small" weight="plus" className="text-ui-fg-subtle">
                                    Failed Attempts
                                </Text>
                                <Badge
                                    color={status.attempts >= 4 ? "red" : "orange"}
                                    size="xsmall"
                                >
                                    {status.attempts} / 5
                                </Badge>
                            </div>
                        )}

                    </div>
                )}

            </div>
        </Container>
    )
}

// ── Widget config (Medusa v2) ─────────────────────────────────────────────────
// Injected below the order summary on Admin → Orders → [order] detail page.
// Receives AdminOrder as the `data` prop automatically.

export const config = defineWidgetConfig({
    zone: "order.details.after",
})

export default CodOtpStatusWidget
