import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChartBar, ArrowUpRightOnBox, ExclamationCircle, CheckCircleSolid, Spinner } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Text,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../../lib/sdk"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type GA4NotConfigured = {
  configured: false
  measurement_tracking: boolean
  missing: string[]
}

type GA4Data = {
  configured: true
  measurement_tracking: boolean
  days: number
  property_id: string
  activation_url?: string
  hint?: string
  summary: {
    sessions: number
    active_users: number
    page_views: number
    bounce_rate: number
    avg_session_duration: number
    new_users: number
  }
  ecommerce_events: { name: string; count: number }[]
  top_events: { name: string; count: number }[]
  top_pages: { path: string; views: number; users: number }[]
  trend: { date: string; sessions: number; users: number }[]
  error?: string
}

type GA4Response = GA4NotConfigured | GA4Data

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(1)}K`
    : String(n)

const fmtDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

const EVENT_LABEL: Record<string, string> = {
  add_to_cart: "Add to Cart",
  remove_from_cart: "Remove from Cart",
  view_item: "View Product",
  begin_checkout: "Begin Checkout",
  add_shipping_info: "Add Shipping Info",
  add_payment_info: "Add Payment Info",
  purchase: "Purchase",
  refund: "Refund",
}

const DAYS_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
]

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const MetricCard = ({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) => (
  <div className="flex flex-col gap-1 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-4 min-w-0">
    <Text size="small" className="text-ui-fg-muted">
      {label}
    </Text>
    <Text className="text-xl font-semibold tabular-nums">{value}</Text>
    {sub && (
      <Text size="xsmall" className="text-ui-fg-subtle">
        {sub}
      </Text>
    )}
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Setup Guide (shown when GA_PROPERTY_ID / GA_SERVICE_ACCOUNT_KEY are missing)
// ─────────────────────────────────────────────────────────────────────────────

const SetupGuide = ({
  missing,
  hasTracking,
}: {
  missing: string[]
  hasTracking: boolean
}) => (
  <Container className="flex flex-col gap-6">
    <div className="flex items-start gap-3">
      <ExclamationCircle className="text-ui-fg-warning mt-0.5 shrink-0" />
      <div className="flex flex-col gap-1">
        <Heading level="h2">Dashboard setup required</Heading>
        <Text className="text-ui-fg-subtle">
          The reporting dashboard needs two more env vars. Server-side event
          tracking ({hasTracking ? "✓ active" : "✗ inactive"}) is a separate
          feature and already works without these.
        </Text>
      </div>
    </div>

    <div className="rounded-lg border border-ui-border-base p-4 flex flex-col gap-3">
      <Text className="font-medium">Missing env vars</Text>
      {missing.map((key) => (
        <div key={key} className="flex flex-col gap-1">
          <code className="text-ui-fg-base font-mono text-sm bg-ui-bg-highlight px-2 py-0.5 rounded w-fit">
            {key}
          </code>
          {key === "GA_PROPERTY_ID" && (
            <Text size="small" className="text-ui-fg-subtle ml-1">
              Your numeric GA4 property ID — visible in the Admin URL:{" "}
              <code className="font-mono">…/p503245289/admin</code>
            </Text>
          )}
          {key === "GA_SERVICE_ACCOUNT_KEY" && (
            <Text size="small" className="text-ui-fg-subtle ml-1">
              JSON string of a Google Cloud Service Account key with{" "}
              <strong>Viewer</strong> access on this GA4 property.
            </Text>
          )}
        </div>
      ))}
    </div>

    <div className="rounded-lg border border-ui-border-base p-4 flex flex-col gap-2">
      <Text className="font-medium">How to get GA_SERVICE_ACCOUNT_KEY</Text>
      <ol className="flex flex-col gap-1 list-decimal list-inside">
        {[
          "Open Google Cloud Console → IAM & Admin → Service Accounts",
          "Create a new service account (e.g. vridhira-ga4-reader)",
          "Click the account → Keys → Add Key → JSON — download the file",
          "In Google Analytics → Admin → Property Access Management → Add the service account email with Viewer role",
          "Paste the entire JSON file contents as a single-line string into GA_SERVICE_ACCOUNT_KEY in your .env",
        ].map((step, i) => (
          <li key={i}>
            <Text size="small" className="inline text-ui-fg-subtle">
              {step}
            </Text>
          </li>
        ))}
      </ol>
    </div>

    <div className="flex gap-2">
      <Button
        variant="secondary"
        size="small"
        onClick={() =>
          window.open(
            "https://console.cloud.google.com/iam-admin/serviceaccounts",
            "_blank"
          )
        }
      >
        Open Google Cloud Console
        <ArrowUpRightOnBox />
      </Button>
      <Button
        variant="secondary"
        size="small"
        onClick={() =>
          window.open("https://analytics.google.com/analytics/web/#/a366168585p503245289/admin/usermanagement/property", "_blank")
        }
      >
        GA4 Property Access
        <ArrowUpRightOnBox />
      </Button>
    </div>
  </Container>
)

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

const GA4Page = () => {
  const [days, setDays] = useState(30)

  const { data, isLoading, isError, refetch } = useQuery<GA4Response>({
    queryKey: ["ga4-report", days],
    queryFn: () =>
      sdk.client.fetch<GA4Response>(`/admin/custom/ga4?days=${days}`),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  // ── Loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-ui-fg-muted">
        <Spinner className="animate-spin" />
        <Text>Loading GA4 data…</Text>
      </div>
    )
  }

  // ── Fetch error
  if (isError || !data) {
    return (
      <Container className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-ui-fg-error">
          <ExclamationCircle />
          <Text>Failed to reach the GA4 backend route.</Text>
        </div>
        <Button variant="secondary" size="small" onClick={() => refetch()}>
          Retry
        </Button>
      </Container>
    )
  }

  // ── Not configured
  if (!data.configured) {
    return (
      <SetupGuide
        missing={(data as GA4NotConfigured).missing}
        hasTracking={(data as GA4NotConfigured).measurement_tracking}
      />
    )
  }

  const d = data as GA4Data

  // ── API-level error (e.g. wrong credentials or API disabled)
  if (d.error) {
    return (
      <Container className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-ui-fg-error">
          <ExclamationCircle />
          <Heading level="h2">GA4 API Error</Heading>
        </div>
        <Text className="text-ui-fg-subtle">{d.error}</Text>
        {d.hint && (
          <Text size="small" className="text-ui-fg-muted">{d.hint}</Text>
        )}
        <div className="flex gap-2 flex-wrap">
          {d.activation_url && (
            <Button
              variant="primary"
              size="small"
              onClick={() => window.open(d.activation_url, "_blank")}
            >
              Enable Google Analytics Data API
              <ArrowUpRightOnBox />
            </Button>
          )}
          <Button
            variant="secondary"
            size="small"
            onClick={() =>
              window.open(
                `https://analytics.google.com/analytics/web/#/a366168585p${d.property_id}/admin`,
                "_blank"
              )
            }
          >
            Open GA4 Admin
            <ArrowUpRightOnBox />
          </Button>
        </div>
      </Container>
    )
  }

  // ── Full dashboard
  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Container className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <Heading level="h1">Google Analytics 4</Heading>
            <div className="flex items-center gap-2">
              <CheckCircleSolid className="text-ui-fg-interactive" />
              <Text size="small" className="text-ui-fg-subtle">
                Property {d.property_id} · server-side tracking{" "}
                {d.measurement_tracking ? (
                  <Badge color="green" size="xsmall">active</Badge>
                ) : (
                  <Badge color="orange" size="xsmall">inactive</Badge>
                )}
              </Text>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Days filter */}
            <div className="flex rounded-md border border-ui-border-base overflow-hidden">
              {DAYS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDays(opt.value)}
                  className={[
                    "px-3 py-1 text-sm transition-colors",
                    days === opt.value
                      ? "bg-ui-bg-base-pressed text-ui-fg-base font-medium"
                      : "bg-ui-bg-base text-ui-fg-subtle hover:bg-ui-bg-base-hover",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <Button
              variant="secondary"
              size="small"
              onClick={() =>
                window.open(
                  `https://analytics.google.com/analytics/web/#/a366168585p${d.property_id}/reports/intelligenthome`,
                  "_blank"
                )
              }
            >
              Open GA4
              <ArrowUpRightOnBox />
            </Button>
          </div>
        </div>
      </Container>

      {/* ── Metric cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Sessions"       value={fmt(d.summary.sessions)} />
        <MetricCard label="Active Users"   value={fmt(d.summary.active_users)} />
        <MetricCard label="New Users"      value={fmt(d.summary.new_users)} />
        <MetricCard label="Page Views"     value={fmt(d.summary.page_views)} />
        <MetricCard
          label="Bounce Rate"
          value={`${d.summary.bounce_rate}%`}
          sub={d.summary.bounce_rate > 70 ? "High — check content" : undefined}
        />
        <MetricCard
          label="Avg. Session"
          value={fmtDuration(d.summary.avg_session_duration)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Ecommerce events ──────────────────────────────────────────── */}
        <Container className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Heading level="h2">Ecommerce Events</Heading>
            <Badge color="blue" size="xsmall">server-side</Badge>
          </div>
          {d.ecommerce_events.length === 0 ? (
            <Text className="text-ui-fg-muted text-sm">
              No ecommerce events recorded yet. Add a product to cart to test.
            </Text>
          ) : (
            <div className="flex flex-col divide-y divide-ui-border-base">
              {d.ecommerce_events.map((ev) => (
                <div
                  key={ev.name}
                  className="flex items-center justify-between py-2"
                >
                  <Text size="small">
                    {EVENT_LABEL[ev.name] ?? ev.name}
                  </Text>
                  <Badge color="grey" size="xsmall">
                    {fmt(ev.count)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Container>

        {/* ── Top pages ────────────────────────────────────────────────── */}
        <Container className="flex flex-col gap-4">
          <Heading level="h2">Top Pages</Heading>
          {d.top_pages.length === 0 ? (
            <Text className="text-ui-fg-muted text-sm">No page data yet.</Text>
          ) : (
            <div className="flex flex-col divide-y divide-ui-border-base">
              {d.top_pages.map((page) => (
                <div
                  key={page.path}
                  className="flex items-center justify-between py-2 gap-2"
                >
                  <Text
                    size="small"
                    className="text-ui-fg-base truncate font-mono"
                    title={page.path}
                  >
                    {page.path}
                  </Text>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge color="grey" size="xsmall">
                      {fmt(page.views)} views
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Container>
      </div>

      {/* ── All events ───────────────────────────────────────────────────── */}
      <Container className="flex flex-col gap-4">
        <Heading level="h2">Top Events</Heading>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {d.top_events.map((ev) => (
            <div
              key={ev.name}
              className="rounded-md border border-ui-border-base bg-ui-bg-subtle px-3 py-2 flex flex-col gap-0.5"
            >
              <Text size="xsmall" className="text-ui-fg-muted font-mono truncate" title={ev.name}>
                {ev.name}
              </Text>
              <Text size="small" className="font-semibold tabular-nums">
                {fmt(ev.count)}
              </Text>
            </div>
          ))}
        </div>
      </Container>

      {/* ── Trend table (last N days) ─────────────────────────────────────── */}
      {d.trend.length > 0 && (
        <Container className="flex flex-col gap-4">
          <Heading level="h2">Daily Trend — last {d.days} days</Heading>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border-base text-ui-fg-muted">
                  <th className="pb-2 text-left font-medium">Date</th>
                  <th className="pb-2 text-right font-medium pr-4">Sessions</th>
                  <th className="pb-2 text-right font-medium">Users</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border-base">
                {[...d.trend].reverse().slice(0, 14).map((row) => {
                  const d2 = row.date // YYYYMMDD
                  const label = `${d2.slice(0, 4)}-${d2.slice(4, 6)}-${d2.slice(6, 8)}`
                  return (
                    <tr key={row.date} className="text-ui-fg-base">
                      <td className="py-1.5 font-mono text-ui-fg-subtle">{label}</td>
                      <td className="py-1.5 text-right pr-4 tabular-nums">{fmt(row.sessions)}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmt(row.users)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Container>
      )}
    </div>
  )
}

export default GA4Page

export const config = defineRouteConfig({
  label: "GA4 Analytics",
  icon:  ChartBar,
})
