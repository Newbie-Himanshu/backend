import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createSign } from "crypto"

// ── GET /admin/custom/ga4 ──────────────────────────────────────────────────
// Uses GA4 Data API over plain HTTPS REST — no gRPC, no proto-loader, no
// native bindings. Works reliably on Windows without any extra packages.
//
// Query params:
//   days  number of days to look back (7 | 30 | 90, default: 30)
//
// Requires env vars:
//   GA_PROPERTY_ID          — numeric GA4 property ID (e.g. 503245289)
//   GA_SERVICE_ACCOUNT_KEY  — JSON string of a Google Service Account key
//                             with "Viewer" access on the GA4 property

// ── Service-account JWT → OAuth2 access token ─────────────────────────────

type ServiceAccountKey = { client_email: string; private_key: string }
type TokenCache = { token: string; expiresAt: number }
let _tokenCache: TokenCache | null = null

async function getAccessToken(key: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (_tokenCache && _tokenCache.expiresAt > now + 60) return _tokenCache.token

  const header  = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify({
    iss:   key.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
  })).toString("base64url")

  const sign = createSign("RSA-SHA256")
  sign.update(`${header}.${payload}`)
  const sig = sign.sign(key.private_key, "base64url")
  const jwt = `${header}.${payload}.${sig}`

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:  jwt,
    }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Token exchange failed (${resp.status}): ${text}`)
  }
  const data: any = await resp.json()
  _tokenCache = { token: data.access_token, expiresAt: now + (data.expires_in ?? 3600) }
  return _tokenCache.token
}

// ── GA4 Data API REST helper ───────────────────────────────────────────────

async function runReport(token: string, propertyId: string, body: object): Promise<any> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`
  const resp = await fetch(url, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  })
  if (!resp.ok) {
    const text = await resp.text()
    let message = `GA4 API error (${resp.status})`
    let activationUrl: string | undefined
    try {
      const errJson  = JSON.parse(text)
      const errObj   = errJson?.error
      if (errObj?.message) message = errObj.message
      for (const detail of errObj?.details ?? []) {
        if (detail?.metadata?.activationUrl) {
          activationUrl = detail.metadata.activationUrl
          break
        }
        for (const link of detail?.links ?? []) {
          if ((link?.url as string)?.includes("analyticsdata")) {
            activationUrl = link.url
            break
          }
        }
        if (activationUrl) break
      }
    } catch { /* not JSON — keep generic message */ }
    const err = new Error(message) as any
    if (activationUrl) err.activationUrl = activationUrl
    throw err
  }
  return resp.json()
}

const GA_ECOMMERCE_EVENTS = new Set([
  "add_to_cart",
  "remove_from_cart",
  "view_item",
  "begin_checkout",
  "add_shipping_info",
  "add_payment_info",
  "purchase",
  "refund",
])

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const propertyId = process.env.GA_PROPERTY_ID?.trim()
  const rawKey     = process.env.GA_SERVICE_ACCOUNT_KEY?.trim()
  const hasMeasId  = !!process.env.GA_MEASUREMENT_ID?.trim()

  if (!propertyId || !rawKey) {
    return res.json({
      configured:           false,
      measurement_tracking: hasMeasId,
      missing: [
        ...(!propertyId ? ["GA_PROPERTY_ID"] : []),
        ...(!rawKey     ? ["GA_SERVICE_ACCOUNT_KEY"] : []),
      ],
    })
  }

  const { days = "30" } = req.query as Record<string, string>
  const daysNum = Math.max(1, Math.min(90, Number(days) || 30))
  const range   = { startDate: `${daysNum}daysAgo`, endDate: "today" }

  try {
    const key: ServiceAccountKey = JSON.parse(rawKey)
    const token = await getAccessToken(key)

    const [summaryData, eventsData, pagesData, trendData] = await Promise.all([
      // 1. Summary metrics
      runReport(token, propertyId, {
        dateRanges: [range],
        metrics: [
          { name: "sessions" },
          { name: "activeUsers" },
          { name: "screenPageViews" },
          { name: "bounceRate" },
          { name: "averageSessionDuration" },
          { name: "newUsers" },
        ],
      }),
      // 2. Event breakdown
      runReport(token, propertyId, {
        dateRanges: [range],
        dimensions: [{ name: "eventName" }],
        metrics:    [{ name: "eventCount" }],
        orderBys:   [{ metric: { metricName: "eventCount" }, desc: true }],
        limit:      25,
      }),
      // 3. Top pages
      runReport(token, propertyId, {
        dateRanges: [range],
        dimensions: [{ name: "pagePath" }],
        metrics:    [{ name: "screenPageViews" }, { name: "activeUsers" }],
        orderBys:   [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit:      10,
      }),
      // 4. Daily trend
      runReport(token, propertyId, {
        dateRanges: [range],
        dimensions: [{ name: "date" }],
        metrics:    [{ name: "sessions" }, { name: "activeUsers" }],
        orderBys:   [{ dimension: { dimensionName: "date" }, desc: false }],
      }),
    ])

    const sRow = summaryData.rows?.[0]
    const mv   = (i: number) => Number(sRow?.metricValues?.[i]?.value ?? 0)
    const summary = {
      sessions:             mv(0),
      active_users:         mv(1),
      page_views:           mv(2),
      bounce_rate:          parseFloat((mv(3) * 100).toFixed(1)),
      avg_session_duration: Math.round(mv(4)),
      new_users:            mv(5),
    }

    const allEvents = (eventsData.rows ?? []).map((row: any) => ({
      name:  row.dimensionValues?.[0]?.value ?? "",
      count: Number(row.metricValues?.[0]?.value ?? 0),
    }))
    const ecommerce_events = allEvents.filter((e: any) => GA_ECOMMERCE_EVENTS.has(e.name))
    const top_events       = allEvents.slice(0, 10)

    const top_pages = (pagesData.rows ?? []).map((row: any) => ({
      path:  row.dimensionValues?.[0]?.value ?? "",
      views: Number(row.metricValues?.[0]?.value ?? 0),
      users: Number(row.metricValues?.[1]?.value ?? 0),
    }))

    const trend = (trendData.rows ?? []).map((row: any) => ({
      date:     row.dimensionValues?.[0]?.value ?? "",
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
      users:    Number(row.metricValues?.[1]?.value ?? 0),
    }))

    return res.json({
      configured:           true,
      measurement_tracking: hasMeasId,
      days:                 daysNum,
      property_id:          propertyId,
      summary,
      ecommerce_events,
      top_events,
      top_pages,
      trend,
    })
  } catch (err: any) {
    const activationUrl: string | undefined = err?.activationUrl
    return res.json({
      configured:       true,
      measurement_tracking: hasMeasId,
      property_id:      propertyId,
      error:            err?.message ?? "Failed to fetch GA4 data",
      activation_url:   activationUrl,
      hint: activationUrl
        ? "The Google Analytics Data API is not enabled in your Google Cloud project. Click the button below to enable it, then retry."
        : "Ensure the service account has Viewer access on the GA4 property.",
    })
  }
}
