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
API proxy: `src/api/admin/custom/ga4/route.ts`
Admin UI: `src/admin/routes/ga4/page.tsx`

- Admin sidebar page **"GA4 Analytics"** at `/app/ga4`
- Summary metrics: sessions, active users, new users, page views, bounce rate, avg. session duration
- Ecommerce event breakdown, top pages, top events, daily trend table
- Day-range filter: 7 / 30 / 90 days
- Uses GA4 Data API over plain HTTPS REST — no gRPC, no native bindings (works on Windows)
- Service-account JWT authentication with in-memory token caching
- Graceful error states: not-configured setup guide, API-disabled enable link, credential errors
- Requires `GA_PROPERTY_ID` and `GA_SERVICE_ACCOUNT_KEY` (full JSON string)

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
│   ├── routes/
│   │   ├── ga4/                # GA4 Analytics dashboard page
│   │   ├── search-engine/      # Unified search engine management
│   │   └── cod-remittance/     # COD remittance admin page
│   └── widgets/                # Order / product admin widgets
├── api/                        # Custom API routes
│   ├── admin/custom/ga4/       # GET /admin/custom/ga4 — GA4 Data API proxy
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
    <source media="(prefers-color-scheme: light)" srcset="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
    <img alt="Medusa logo" src="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
    </picture>
  </a>
</p>
<h1 align="center">
  Medusa
</h1>

<h4 align="center">
  <a href="https://docs.medusajs.com">Documentation</a> |
  <a href="https://www.medusajs.com">Website</a>
</h4>

<p align="center">
  Building blocks for digital commerce
</p>
<p align="center">
  <a href="https://github.com/medusajs/medusa/blob/master/CONTRIBUTING.md">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat" alt="PRs welcome!" />
  </a>
    <a href="https://www.producthunt.com/posts/medusa"><img src="https://img.shields.io/badge/Product%20Hunt-%231%20Product%20of%20the%20Day-%23DA552E" alt="Product Hunt"></a>
  <a href="https://discord.gg/xpCwq3Kfn8">
    <img src="https://img.shields.io/badge/chat-on%20discord-7289DA.svg" alt="Discord Chat" />
  </a>
  <a href="https://twitter.com/intent/follow?screen_name=medusajs">
    <img src="https://img.shields.io/twitter/follow/medusajs.svg?label=Follow%20@medusajs" alt="Follow @medusajs" />
  </a>
</p>

## Compatibility

This starter is compatible with versions >= 2 of `@medusajs/medusa`. 

## Getting Started

Visit the [Quickstart Guide](https://docs.medusajs.com/learn/installation) to set up a server.

Visit the [Docs](https://docs.medusajs.com/learn/installation#get-started) to learn more about our system requirements.

## What is Medusa

Medusa is a set of commerce modules and tools that allow you to build rich, reliable, and performant commerce applications without reinventing core commerce logic. The modules can be customized and used to build advanced ecommerce stores, marketplaces, or any product that needs foundational commerce primitives. All modules are open-source and freely available on npm.

Learn more about [Medusa’s architecture](https://docs.medusajs.com/learn/introduction/architecture) and [commerce modules](https://docs.medusajs.com/learn/fundamentals/modules/commerce-modules) in the Docs.

## Build with AI Agents

### Claude Code Plugin

If you use AI agents like Claude Code, check out the [medusa-dev Claude Code plugin](https://github.com/medusajs/medusa-claude-plugins).

### Other Agents

If you use AI agents other than Claude Code, copy the [skills directory](https://github.com/medusajs/medusa-claude-plugins/tree/main/plugins/medusa-dev/skills) into your agent's relevant `skills` directory.

### MCP Server

You can also add the MCP server `https://docs.medusajs.com/mcp` to your AI agents to answer questions related to Medusa. The `medusa-dev` Claude Code plugin includes this MCP server by default.

## Community & Contributions

The community and core team are available in [GitHub Discussions](https://github.com/medusajs/medusa/discussions), where you can ask for support, discuss roadmap, and share ideas.

Join our [Discord server](https://discord.com/invite/medusajs) to meet other community members.

## Other channels

- [GitHub Issues](https://github.com/medusajs/medusa/issues)
- [Twitter](https://twitter.com/medusajs)
- [LinkedIn](https://www.linkedin.com/company/medusajs)
- [Medusa Blog](https://medusajs.com/blog/)
