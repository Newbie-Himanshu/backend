# Vridhira Marketplace — Backend

An India-focused e-commerce backend built on **MedusaJS v2**, extending the framework with payment, fulfilment, search, analytics, and communication integrations tailored for the Indian market.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Commerce framework | MedusaJS v2 (v2.13.1) |
| Language | TypeScript |
| Database | PostgreSQL |
| Cache / queues | Redis |
| Email | Resend + React Email |
| Payments | Razorpay (UPI, cards, wallets, COD) |
| Fulfilment | Shiprocket |
| Search | Algolia **or** Meilisearch (runtime switchable) |
| Analytics | Google Analytics 4 (Measurement Protocol + Data API) |
| Auth | Email / password + Google OAuth |

---

## Features

### Payments — Razorpay (`medusa-plugin-razorpay-v2`)
- Full Razorpay checkout flow: UPI, cards, net banking, wallets
- Webhook handler at `POST /hooks/razorpay` verifies HMAC signature
- Admin panel widget shows Razorpay payment link for every order

### Cash on Delivery (`src/modules/cod-payment/`)
- Custom payment provider for COD orders
- OTP verification (via Twilio) before delivery confirmation
- Configurable order-value threshold — orders above the limit require OTP
- Redis-backed attempt counter + rate limiting prevents brute-force

### Fulfilment — Shiprocket (`src/modules/shiprocket-fulfillment/`)
- Implements MedusaJS `AbstractFulfillmentProviderService`
- Automatic AWB (airway bill) assignment and shipment creation on order placement
- Serviceability checks using `SHIPROCKET_PICKUP_POSTCODE`
- Pickup location driven by `SHIPROCKET_PICKUP_LOCATION` env var (no hardcoding)
- Webhook at `POST /hooks/shiprocket` updates order status (shipped → delivered)

### Email — Resend + React Email (`src/modules/resend/`)
- Transactional emails: order placed, shipped, delivered, cancelled, refunded
- Password reset, email verification
- Templates built with `@react-email/components`
- Preview server: `yarn dev:email`

### Search — Algolia (`src/modules/algolia/`)
- Full product index with upsert on create/update, delete on removal
- Admin endpoint `POST /admin/algolia/sync` triggers full paginated reindex
- Subscribers: `product-sync.ts`, `product-delete.ts`, `algolia-sync.ts`
- Configurable via `ALGOLIA_APP_ID`, `ALGOLIA_API_KEY`, `ALGOLIA_PRODUCT_INDEX_NAME`

### Search — Meilisearch (`src/modules/meilisearch/`)
- Drop-in alternative to Algolia; both modules can be registered simultaneously
- Graceful no-op if env vars are absent (logs warning, does not crash)
- Admin unified **Search Engine** page lets you switch providers at runtime
- Configurable via `MEILISEARCH_HOST`, `MEILISEARCH_API_KEY`, `MEILISEARCH_PRODUCT_INDEX_NAME`

### Google Analytics 4 — Measurement Protocol
- Tracks ecommerce events server-side via GA4 Measurement Protocol:
  `add_to_cart`, `remove_from_cart`, `add_shipping_info`, `add_payment_info`, `purchase`, `refund`
- Plugin: `@variablevic/google-analytics-medusa`
- Requires `GA_MEASUREMENT_ID` and `GA_API_SECRET`

### Google Analytics 4 — Admin Dashboard

A full multi-tab analytics suite embedded in the Medusa admin panel. All reporting uses the GA4 Data API over plain HTTPS REST — no gRPC, no native bindings (works on Windows and any Node environment).

**Shared backend** (`src/api/admin/custom/ga4/_lib.ts`): Service-account JWT auth with 55-min token cache; 15-min report cache keyed by endpoint + day-range.

**Shared frontend** (`src/admin/lib/ga4-shared.tsx`): `MetricCard`, `DaysFilter`, `GA4NavCard`, `GA4PageHeader`, `LoadingState`, `ErrorState`, `inr()`, `fmt()`, `fmtDuration()`; `useGA4Hotkeys()` for keyboard navigation.

#### Tab 1 — Overview `/app/ga4`
- Summary KPI cards: Sessions, Active Users, New Users, Page Views, Bounce Rate, Avg. Session Duration
- Revenue row: Total Revenue (₹), Orders, Average Order Value (when GA4 ecommerce is active)
- Ecommerce event breakdown + Top Pages + Top Events + Daily Trend table
- Navigation cards to all 4 child tabs with hotkey badges
- Keyboard shortcuts: **G A** = overview, **G A P** = performance, **G A R** = products, **G A C** = acquisition, **G A F** = funnel

#### Tab 2 — Performance `/app/ga4/performance`
- KPI cards: Total Revenue, Orders, AOV, Conversion Rate (color-coded), Total Sessions
- Peak Revenue Day callout
- Daily Revenue Trend table (last 14 days, most-recent first)
- API: `GET /admin/custom/ga4/performance?days=30`

#### Tab 3 — Products `/app/ga4/products`
- Sortable product table (6 sort columns: revenue / units sold / views / add-to-cart / cart% / refunds)
- Per-product: Revenue (₹), Sold, Views, Cart Adds, Cart-to-Detail %, Refunds with color-coded badges
- API: `GET /admin/custom/ga4/products?days=30`

#### Tab 4 — Acquisition `/app/ga4/acquisition`
- 3-tab view: **Channels** (revenue + conversion rate) · **Sources** (bounce rate, session duration) · **Campaigns** (UTM data, filters `(not set)`)
- Summary KPIs: Acquisition Revenue, Orders, Total Sessions, Top Channel
- API: `GET /admin/custom/ga4/acquisition?days=30`

#### Tab 5 — Funnel `/app/ga4/funnel`
- Visual proportional funnel bars: View Item → Add to Cart → Begin Checkout → Purchase
- Step breakdown table: retained % (color-coded) + drop-off %
- Cart Abandonment Rate + Overall Conversion (view→purchase) summary
- Daily funnel last 7 days table
- API: `GET /admin/custom/ga4/funnel?days=30`

#### Widget GA4 Hotlinks
Every admin widget has a context-appropriate **"GA4 ↗"** link that routes directly to the relevant analytics tab:

| Widget | Hotlink target |
|--------|----------------|
| `razorpay-order-widget` | Performance tab |
| `razorpay-customer-widget` | Acquisition tab |
| `razorpay-summary-widget` | Overview tab |
| `cod-remittance-widget` | Funnel tab |
| `cod-otp-status` | Funnel tab |

**Authentication:** Service-account JWT → OAuth2 Bearer token, automatically refreshed every 55 min.  
**Graceful error states:** not-configured setup guide, API-disabled enable link, credential errors.  
**Required env vars:** `GA_PROPERTY_ID`, `GA_SERVICE_ACCOUNT_KEY` (full JSON key file content as a single-line string).

### Wishlist (`src/modules/wishlist/`)
- Custom Medusa module with `WishlistItem` data model
- Links to Customer and Product via module links
- REST endpoints: add, remove, list wishlist items

### Marketplace Plugins

| Plugin | Purpose |
|--------|---------|
| `@lambdacurry/medusa-product-reviews` | Ratings, moderation, admin responses (default: pending approval) |
| `medusa-variant-images` | Per-variant image storage via metadata |
| `@rsc-labs/medusa-documents-v2` | Generate & download PDF invoices / packing slips from order view |
| `@alpha-solutions/medusa-image-alt` | Manage `alt_text` on product images via admin widget |
| `@lambdacurry/medusa-webhooks` | Send HTTP notifications to external services on Medusa events |
| `@codee-sh/medusa-plugin-automations` | Workflow automations |

### Google OAuth
- Social login via Google OAuth 2.0
- Configurable redirect URL via `GOOGLE_CALLBACK_URL`

### Logging (`src/lib/logger.ts`)
- Structured JSON logging with `pino`
- Log level controlled by `LOG_LEVEL` env var

### Security
- Production startup guard: rejects default `JWT_SECRET` / `COOKIE_SECRET` values
- Centralised Razorpay client prevents multiple instantiations
- Invoice IDOR fix: orders validated against requesting customer
- COD OTP: Redis-backed session ownership + attempt counter hardening
- AWB proxy: strips internal credentials before forwarding tracking requests

---

## Prerequisites

- Node.js >= 20
- PostgreSQL 14+
- Redis 6+
- Yarn

---

## Setup

```bash
# 1. Install dependencies
yarn install

# 2. Copy the env template and fill in your values
cp .env.template .env

# 3. Run database migrations
yarn medusa db:migrate

# 4. (Optional) Seed sample data
yarn seed

# 5. Start development server
yarn dev
```

---

## Environment Variables

Copy `.env.template` to `.env` and fill in all values.

| Group | Variables |
|-------|-----------|
| Database | `DATABASE_URL`, `DB_NAME` |
| Redis | `REDIS_URL` |
| Auth secrets | `JWT_SECRET`, `COOKIE_SECRET` |
| CORS | `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS` |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_ACCOUNT` |
| Shiprocket | `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `SHIPROCKET_WEBHOOK_TOKEN`, `SHIPROCKET_PICKUP_POSTCODE`, `SHIPROCKET_PICKUP_LOCATION` |
| Resend | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Twilio (COD OTP) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_PHONE` |
| Stock location | `MEDUSA_STOCK_LOCATION_ID` |
| Algolia | `ALGOLIA_APP_ID`, `ALGOLIA_API_KEY`, `ALGOLIA_PRODUCT_INDEX_NAME` |
| Meilisearch | `MEILISEARCH_HOST`, `MEILISEARCH_API_KEY`, `MEILISEARCH_PRODUCT_INDEX_NAME` |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` |
| GA4 Measurement Protocol | `GA_MEASUREMENT_ID`, `GA_API_SECRET` |
| GA4 Data API (admin dashboard) | `GA_PROPERTY_ID`, `GA_SERVICE_ACCOUNT_KEY` |

> **Production:** `JWT_SECRET` and `COOKIE_SECRET` must be strong random values.
> Generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

---

## Project Structure

```
src/
├── admin/                      # Admin UI extensions
│   ├── lib/
│   │   └── ga4-shared.tsx      # Shared GA4 components, formatters, hotkeys hook
│   ├── routes/
│   │   ├── ga4/                # GA4 Analytics overview (+ 4 child tabs)
│   │   │   ├── performance/    #   Revenue, orders, AOV, conversion rate
│   │   │   ├── products/       #   Per-product revenue, views, cart rate
│   │   │   ├── acquisition/    #   Channels, sources, UTM campaigns
│   │   │   └── funnel/         #   View → Cart → Checkout → Purchase funnel
│   │   ├── search-engine/      # Unified search engine management
│   │   └── cod-remittance/     # COD remittance admin page
│   └── widgets/                # Order / product admin widgets (all with GA4 hotlinks)
├── api/                        # Custom API routes
│   ├── admin/custom/ga4/
│   │   ├── _lib.ts             #   Shared auth + 15-min report cache
│   │   ├── route.ts            #   GET /admin/custom/ga4 — overview
│   │   ├── performance/        #   GET /admin/custom/ga4/performance
│   │   ├── products/           #   GET /admin/custom/ga4/products
│   │   ├── acquisition/        #   GET /admin/custom/ga4/acquisition
│   │   └── funnel/             #   GET /admin/custom/ga4/funnel
│   ├── admin/algolia/          # POST /admin/algolia/sync
│   └── hooks/                  # Razorpay & Shiprocket webhooks
├── jobs/                       # Scheduled jobs
├── lib/                        # Shared utilities
│   ├── logger.ts               # Pino structured logger
│   ├── razorpay.ts             # Centralised Razorpay client
│   ├── redis-client.ts         # Redis singleton
│   └── search-config.ts        # Search engine runtime config
├── links/                      # Module link definitions
├── modules/                    # Custom Medusa modules
│   ├── algolia/
│   ├── cod-payment/
│   ├── meilisearch/
│   ├── resend/
│   ├── shiprocket-fulfillment/
│   └── wishlist/
├── scripts/                    # Seed scripts (products, GST taxes, India regions)
├── services/                   # Standalone service classes
├── subscribers/                # Event subscribers (order emails, search index sync)
└── workflows/                  # MedusaJS workflows (order emails, search sync, wishlist)
```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `yarn dev` | Start development server with hot reload |
| `yarn build` | Build for production |
| `yarn start` | Start production server |
| `yarn seed` | Seed sample products, regions, and GST taxes |
| `yarn dev:email` | Preview email templates in browser |
| `yarn test:unit` | Run unit tests |
| `yarn test:integration:http` | Run HTTP integration tests |

---

## Documentation

Full engineering docs are in the [`docs/`](docs/) folder:

| File | Contents |
|------|----------|
| [docs/check-before-development.md](docs/check-before-development.md) | Every env var, API key, webhook, and configuration requirement; deployment checklist |
| [docs/build-log-2026-02-19.md](docs/build-log-2026-02-19.md) | COD, Razorpay, Shiprocket, Resend, Google OAuth, email verification |
| [docs/build-log-2026-02-24.md](docs/build-log-2026-02-24.md) | Algolia search, Meilisearch search, unified Search Engine admin UI |
| [docs/build-log-2026-02-25.md](docs/build-log-2026-02-25.md) | GA4 Analytics admin dashboard, pino logging, security hardening |
| [docs/walkthrough.md](docs/walkthrough.md) | Shiprocket integration refactor — architectural notes |

---

## License

MIT

---

## Author

Built with ❤️ by **Himanshu**

[![GitHub](https://img.shields.io/badge/GitHub-Newbie--Himanshu-181717?style=flat&logo=github)](https://github.com/Newbie-Himanshu)

---

## Credits

- [MedusaJS](https://medusajs.com) — open-source commerce engine powering the backend
- [Razorpay](https://razorpay.com) — payment gateway
- [Shiprocket](https://shiprocket.in) — fulfilment & logistics
- [Resend](https://resend.com) + [React Email](https://react.email) — transactional emails
- [Algolia](https://www.algolia.com) & [Meilisearch](https://www.meilisearch.com) — product search
- [Google Analytics 4](https://analytics.google.com) — ecommerce analytics
- [Twilio](https://twilio.com) — SMS OTP for COD verification
