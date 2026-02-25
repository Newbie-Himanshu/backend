/**
 * Shared types, helpers, constants and sub-components for all GA4 admin pages.
 * Import from this file in every ga4 route to avoid duplication.
 */

import {
  Badge,
  Button,
  Container,
  Heading,
  Text,
} from "@medusajs/ui"
import {
  ArrowUpRightOnBox,
  ExclamationCircle,
  Spinner,
} from "@medusajs/icons"
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { sdk } from "./sdk"

export { sdk }

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
// Three-stroke G → A → X pattern:
//   G A        → GA4 Overview   (600 ms timeout then navigate)
//   G A P      → Performance
//   G A R      → Products (Revenue/items)
//   G A C      → Acquisition (Customer)
//   G A F      → Funnel
// Second key "A" is unused by Medusa core (G+O, G+P, G+C, G+T, G+M, G+S etc.)
export const HOTKEYS = {
  overview:    { keys: "G A",   path: "/ga4" },
  performance: { keys: "G A P", path: "/ga4/performance" },
  products:    { keys: "G A R", path: "/ga4/products" },
  acquisition: { keys: "G A C", path: "/ga4/acquisition" },
  funnel:      { keys: "G A F", path: "/ga4/funnel" },
} as const

/**
 * Registers the GA4 G→A→X three-stroke keyboard shortcuts.
 * State machine identical to the Razorpay G→Z→X pattern.
 */
export function useGA4Hotkeys() {
  const navigate = useNavigate()
  useEffect(() => {
    let gActive  = false
    let gTimer:  ReturnType<typeof setTimeout> | null = null
    let gaActive = false
    let gaTimer: ReturnType<typeof setTimeout> | null = null

    function reset() {
      gActive  = false
      gaActive = false
      if (gTimer)  { clearTimeout(gTimer);  gTimer  = null }
      if (gaTimer) { clearTimeout(gaTimer); gaTimer = null }
    }

    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) return

      const key = e.key.toUpperCase()

      if (!gActive) {
        if (key === "G") {
          gActive = true
          gTimer  = setTimeout(reset, 1500)
        }
        return
      }

      if (gActive && !gaActive) {
        if (key === "A") {
          if (gTimer) { clearTimeout(gTimer); gTimer = null }
          gaActive = true
          gaTimer  = setTimeout(() => {
            navigate(HOTKEYS.overview.path)
            reset()
          }, 600)
        } else {
          reset()
        }
        return
      }

      if (gaActive) {
        if (gaTimer) { clearTimeout(gaTimer); gaTimer = null }
        switch (key) {
          case "P": navigate(HOTKEYS.performance.path); break
          case "R": navigate(HOTKEYS.products.path);    break
          case "C": navigate(HOTKEYS.acquisition.path); break
          case "F": navigate(HOTKEYS.funnel.path);      break
          default:  navigate(HOTKEYS.overview.path);    break
        }
        reset()
      }
    }

    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [navigate])
}

// ── Formatters ────────────────────────────────────────────────────────────────

/** Format number with K/M suffix */
export function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(Math.round(n))
}

/** Format seconds as "Xm Ys" */
export function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.round(secs % 60)
  return `${m}m ${s}s`
}

/** Format as Indian Rupees */
export function inr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style:    "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Format percentage with sign */
export function fmtPct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`
}

// ── Days filter ───────────────────────────────────────────────────────────────

export const DAYS_OPTIONS = [
  { label: "7 days",  value: 7  },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
]

// ── Shared components ─────────────────────────────────────────────────────────

/** Metric card — used on all pages */
export const MetricCard = ({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string | number
  sub?: string
  highlight?: "green" | "red" | "orange"
}) => {
  const valueColor =
    highlight === "green"  ? "text-ui-fg-interactive" :
    highlight === "red"    ? "text-ui-fg-error" :
    highlight === "orange" ? "text-ui-fg-warning" :
    "text-ui-fg-base"

  return (
    <Container className="flex flex-col gap-1 p-4">
      <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wide">
        {label}
      </Text>
      <Text size="xlarge" className={`font-bold tabular-nums ${valueColor}`}>
        {value}
      </Text>
      {sub && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {sub}
        </Text>
      )}
    </Container>
  )
}

/** Days filter toggle bar */
export const DaysFilter = ({
  days,
  onChange,
}: {
  days: number
  onChange: (d: number) => void
}) => (
  <div className="flex rounded-md border border-ui-border-base overflow-hidden">
    {DAYS_OPTIONS.map((opt) => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
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
)

/** Hotkey badge showing keystrokes */
export const HotkeyBadge = ({ keys }: { keys: string }) => (
  <div className="flex items-center gap-0.5">
    {keys.split(" ").map((k, i) => (
      <span
        key={i}
        className="inline-flex items-center justify-center rounded border border-ui-border-base bg-ui-bg-highlight px-1.5 py-0.5 text-xs font-mono text-ui-fg-subtle"
      >
        {k}
      </span>
    ))}
  </div>
)

/** Navigation card linking to a child route */
export const GA4NavCard = ({
  label,
  description,
  href,
  hotkey,
  badge,
}: {
  label: string
  description: string
  href: string
  hotkey: string
  badge?: { text: string; color: "green" | "orange" | "red" | "blue" | "grey" }
}) => {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(href)}
      className="rounded-lg border border-ui-border-base bg-ui-bg-base px-4 py-3 flex flex-col gap-1.5 text-left hover:bg-ui-bg-base-hover transition-colors w-full"
    >
      <div className="flex items-center justify-between gap-2">
        <Text className="font-medium text-ui-fg-base">{label}</Text>
        <div className="flex items-center gap-2">
          {badge && <Badge color={badge.color} size="xsmall">{badge.text}</Badge>}
          <HotkeyBadge keys={hotkey} />
        </div>
      </div>
      <Text size="small" className="text-ui-fg-subtle">
        {description}
      </Text>
    </button>
  )
}

// ── Shared loading / error states ─────────────────────────────────────────────

export const LoadingState = () => (
  <div className="flex items-center justify-center h-48 gap-2 text-ui-fg-muted">
    <Spinner className="animate-spin" />
    <Text>Loading GA4 data…</Text>
  </div>
)

export const ErrorState = ({ onRetry }: { onRetry: () => void }) => (
  <Container className="flex flex-col gap-3">
    <div className="flex items-center gap-2 text-ui-fg-error">
      <ExclamationCircle />
      <Text>Failed to reach the GA4 backend route.</Text>
    </div>
    <Button variant="secondary" size="small" onClick={onRetry}>Retry</Button>
  </Container>
)

export const APIErrorState = ({
  error,
  hint,
  activationUrl,
  propertyId,
}: {
  error: string
  hint?: string
  activationUrl?: string
  propertyId?: string
}) => (
  <Container className="flex flex-col gap-4">
    <div className="flex items-center gap-2 text-ui-fg-error">
      <ExclamationCircle />
      <Heading level="h2">GA4 API Error</Heading>
    </div>
    <Text className="text-ui-fg-subtle">{error}</Text>
    {hint && <Text size="small" className="text-ui-fg-muted">{hint}</Text>}
    <div className="flex gap-2 flex-wrap">
      {activationUrl && (
        <Button variant="primary" size="small" onClick={() => window.open(activationUrl, "_blank")}>
          Enable Google Analytics Data API
          <ArrowUpRightOnBox />
        </Button>
      )}
      {propertyId && (
        <Button
          variant="secondary"
          size="small"
          onClick={() => window.open(`https://analytics.google.com/analytics/web/#/a366168585p${propertyId}/admin`, "_blank")}
        >
          Open GA4 Admin
          <ArrowUpRightOnBox />
        </Button>
      )}
    </div>
  </Container>
)

/** Back-to-overview breadcrumb bar */
export const GA4PageHeader = ({
  title,
  propertyId,
  days,
  onDaysChange,
  children,
}: {
  title: string
  propertyId?: string
  days: number
  onDaysChange: (d: number) => void
  children?: React.ReactNode
}) => (
  <Container className="flex flex-col gap-4">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex flex-col gap-1">
        <Heading level="h1">{title}</Heading>
        {propertyId && (
          <Text size="small" className="text-ui-fg-subtle">
            Property {propertyId}
          </Text>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <DaysFilter days={days} onChange={onDaysChange} />
        {children}
        <Button
          variant="secondary"
          size="small"
          onClick={() => window.open(
            `https://analytics.google.com/analytics/web/#/a366168585p${propertyId}/reports/intelligenthome`,
            "_blank"
          )}
        >
          Open GA4
          <ArrowUpRightOnBox />
        </Button>
      </div>
    </div>
  </Container>
)
