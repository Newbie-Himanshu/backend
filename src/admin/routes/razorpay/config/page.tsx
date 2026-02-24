import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
    Badge,
    Button,
    Container,
    Heading,
    Text,
    toast,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { ConfigResponse, HOTKEYS, Kbd, METHOD_COLOR, useRazorpayHotkeys } from "../../../lib/razorpay-shared"
import { sdk } from "../../../lib/sdk"

const ConfigPage = () => {
    useRazorpayHotkeys()
    const { data, isLoading, error, refetch, isRefetching } = useQuery<ConfigResponse>({
        queryKey: ["rzp-config"],
        queryFn: () => sdk.client.fetch<ConfigResponse>("/admin/custom/razorpay/config"),
        staleTime: 5 * 60 * 1000,
        retry: false,
    })

    return (
        <div className="p-6 flex flex-col gap-6">
            {/* Page header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <div className="flex items-center gap-3">
                        <Heading>Configuration</Heading>
                        <Kbd className="text-ui-fg-muted">{HOTKEYS.config.keys}</Kbd>
                    </div>
                    <Text size="small" className="text-ui-fg-subtle mt-1">
                        Gateway mode, API connectivity, webhook health and payment methods
                    </Text>
                </div>
                <Button
                    variant="secondary"
                    size="small"
                    isLoading={isRefetching}
                    onClick={() => refetch()}
                >
                    ↻ Re-check
                </Button>
            </div>

            {isLoading ? (
                <Container>
                    <div className="py-8 text-center">
                        <Text className="text-ui-fg-subtle">Checking configuration…</Text>
                    </div>
                </Container>
            ) : error || !data ? (
                <Container>
                    <div className="py-8 text-center">
                        <Text className="text-ui-fg-error">Failed to load configuration.</Text>
                        <Text size="small" className="text-ui-fg-muted mt-1">
                            Ensure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set in your environment.
                        </Text>
                    </div>
                </Container>
            ) : (
                <>
                    {/* ── Gateway Status ── */}
                    <Container>
                        <Heading level="h2" className="mb-4">Gateway Status</Heading>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="border border-ui-border-base rounded-lg p-4 bg-ui-bg-subtle">
                                <Text size="xsmall" className="text-ui-fg-subtle">Mode</Text>
                                <div className="mt-2">
                                    <Badge
                                        color={data.mode === "live" ? "green" : data.mode === "test" ? "orange" : "grey"}
                                        size="xsmall"
                                    >
                                        {data.mode === "live" ? "🟢 LIVE" : data.mode === "test" ? "🟡 TEST" : "Unknown"}
                                    </Badge>
                                </div>
                                <Text size="xsmall" className="text-ui-fg-muted mt-1 font-mono">
                                    {data.key_id_masked}
                                </Text>
                            </div>
                            <div className="border border-ui-border-base rounded-lg p-4 bg-ui-bg-subtle">
                                <Text size="xsmall" className="text-ui-fg-subtle">API Connectivity</Text>
                                <div className="mt-2">
                                    <Badge color={data.api_connected ? "green" : "red"} size="xsmall">
                                        {data.api_connected ? "Connected" : "Failed"}
                                    </Badge>
                                </div>
                                {data.api_error && (
                                    <Text size="xsmall" className="text-ui-fg-error mt-1">{data.api_error}</Text>
                                )}
                            </div>
                            <div className="border border-ui-border-base rounded-lg p-4 bg-ui-bg-subtle">
                                <Text size="xsmall" className="text-ui-fg-subtle">Webhook Health</Text>
                                <div className="mt-2">
                                    <Badge color={data.webhook_reachable ? "green" : "red"} size="xsmall">
                                        {data.webhook_reachable ? "Reachable" : "Unreachable"}
                                    </Badge>
                                </div>
                                <Text size="xsmall" className="text-ui-fg-muted mt-1 break-all font-mono">
                                    {data.webhook_endpoint}
                                </Text>
                            </div>
                            <div className="border border-ui-border-base rounded-lg p-4 bg-ui-bg-subtle">
                                <Text size="xsmall" className="text-ui-fg-subtle">EMI Widget</Text>
                                <div className="mt-2">
                                    <Badge color={data.emi_widget_enabled ? "green" : "grey"} size="xsmall">
                                        {data.emi_widget_enabled ? "Enabled" : "Disabled"}
                                    </Badge>
                                </div>
                                <Text size="xsmall" className="text-ui-fg-muted mt-1">
                                    Set RAZORPAY_EMI_ENABLED=false to disable
                                </Text>
                            </div>
                        </div>

                        {data.mode === "test" && (
                            <div className="mt-4 p-3 rounded-lg border border-amber-300 bg-amber-50">
                                <Text size="small" weight="plus" className="text-amber-700">
                                    ⚠ Test Mode Active
                                </Text>
                                <Text size="small" className="text-amber-600 mt-0.5">
                                    No real money will be charged. Switch to live keys in .env before going to production.
                                </Text>
                            </div>
                        )}
                    </Container>

                    {/* ── Webhook ── */}
                    <Container>
                        <Heading level="h2" className="mb-4">Webhook Configuration</Heading>
                        <div className="flex flex-col gap-3">
                            <div>
                                <Text size="small" weight="plus" className="text-ui-fg-subtle">Endpoint URL</Text>
                                <div className="flex items-center gap-2 mt-1">
                                    <code className="text-sm font-mono bg-ui-bg-subtle px-3 py-1.5 rounded border border-ui-border-base text-ui-fg-base flex-1">
                                        {data.webhook_endpoint}
                                    </code>
                                    <Button
                                        variant="secondary"
                                        size="small"
                                        onClick={() => {
                                            navigator.clipboard.writeText(data.webhook_endpoint)
                                            toast.success("Copied")
                                        }}
                                    >
                                        Copy
                                    </Button>
                                </div>
                            </div>
                            <Text size="small" className="text-ui-fg-subtle">
                                {"Add this URL to your "}
                                <button
                                    onClick={() => window.open("https://dashboard.razorpay.com/app/webhooks", "_blank", "noopener,noreferrer")}
                                    className="text-ui-fg-interactive hover:underline"
                                >
                                    Razorpay Dashboard → Settings → Webhooks ↗
                                </button>
                                {" and subscribe to: payment.authorized, payment.captured, payment.failed, refund.processed."}
                            </Text>
                        </div>
                    </Container>

                    {/* ── Payment Methods ── */}
                    <Container>
                        <div className="mb-4">
                            <Heading level="h2">Payment Methods</Heading>
                            <Text size="small" className="text-ui-fg-subtle mt-1">
                                Method availability is managed in the Razorpay Dashboard, not in code.
                            </Text>
                        </div>
                        <div className="flex flex-col gap-3">
                            {Object.entries(data.methods_info).map(([method, info]) => (
                                <div key={method} className="flex items-start gap-4 py-2 border-b border-ui-border-base last:border-0">
                                    <div className="w-24 shrink-0">
                                        <Badge color={METHOD_COLOR[method] ?? "grey"} size="xsmall">
                                            {method.toUpperCase()}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className={`w-2 h-2 rounded-full ${info.enabled ? "bg-green-500" : "bg-ui-fg-muted"}`} />
                                        <Text size="xsmall" className={info.enabled ? "text-green-700" : "text-ui-fg-muted"}>
                                            {info.enabled ? "Enabled" : "Disabled"}
                                        </Text>
                                    </div>
                                    <Text size="xsmall" className="text-ui-fg-muted">{info.note}</Text>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4">
                            <Button
                                variant="secondary"
                                size="small"
                                onClick={() => window.open("https://dashboard.razorpay.com/app/payment-methods", "_blank", "noopener,noreferrer")}
                            >
                                Manage in Razorpay Dashboard ↗
                            </Button>
                        </div>
                    </Container>

                    {/* ── Environment Variables Reference ── */}
                    <Container>
                        <div className="mb-4">
                            <Heading level="h2">Environment Variables</Heading>
                            <Text size="small" className="text-ui-fg-subtle mt-1">
                                Required variables for this integration to function correctly.
                            </Text>
                        </div>
                        <div className="flex flex-col gap-2">
                            {[
                                { key: "RAZORPAY_KEY_ID", desc: "Your Razorpay API key ID (rzp_test_... or rzp_live_...)", required: true },
                                { key: "RAZORPAY_KEY_SECRET", desc: "Your Razorpay API key secret", required: true },
                                { key: "RAZORPAY_WEBHOOK_SECRET", desc: "Webhook secret for signature verification", required: true },
                                { key: "RAZORPAY_ACCOUNT", desc: "Razorpay account number (for route payments)", required: false },
                                { key: "RAZORPAY_EMI_ENABLED", desc: "Set to false to disable EMI checkout widget", required: false },
                            ].map(item => (
                                <div key={item.key} className="flex items-start gap-4 py-2 border-b border-ui-border-base last:border-0">
                                    <code className="text-xs font-mono bg-ui-bg-subtle px-2 py-0.5 rounded border border-ui-border-base text-ui-fg-base w-72 shrink-0">
                                        {item.key}
                                    </code>
                                    <Badge color={item.required ? "red" : "grey"} size="xsmall">
                                        {item.required ? "Required" : "Optional"}
                                    </Badge>
                                    <Text size="xsmall" className="text-ui-fg-subtle">{item.desc}</Text>
                                </div>
                            ))}
                        </div>
                    </Container>
                </>
            )}
        </div>
    )
}

export const config = defineRouteConfig({
    label: "Config",
})

export const handle = {
    breadcrumb: () => "Config",
}

export default ConfigPage
