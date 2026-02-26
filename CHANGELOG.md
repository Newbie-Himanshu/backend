# Changelog — Vridhira Backend

All notable changes to the Vridhira backend are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [Conventional Commits](https://www.conventionalcommits.org/).

---

## [Unreleased] — 2026-02-26

### Security 🔐
- **BUG-001**: Replace Meilisearch master key with scoped API key — startup guard in `meilisearch/service.ts` detects master/admin keys and throws in production; warns in dev. New setup script `src/scripts/create-meilisearch-scoped-key.ts` creates a least-privilege key (documents.add/get/delete + indexes.search/update on products index only).
- **OTP TOCTOU Race (COD)**: Fixed read-modify-write race in `POST /store/cod/verify-otp`. Now uses atomic Redis `INCR` + Lua script (sets TTL on first increment). Two concurrent OTP attempts now each consume a distinct attempt slot. Falls back to session-data counter when Redis is unavailable so legitimate customers are never blocked by an outage.
- **Global error handler**: Added `errorHandler` in `src/api/middlewares.ts` — `MedusaError` types are forwarded with their HTTP status; all other errors are logged server-side and a sanitized `INTERNAL_ERROR` message is returned to the client, preventing stack trace / table name leakage.

### Added ✨
- **`src/modules/razorpay-queue/`** — BullMQ-based Razorpay event queue module. The `POST /hooks/razorpay` endpoint now does exactly two things: verify HMAC signature (fail-closed), then enqueue the payload. A Worker with 3-attempt exponential-backoff processes events asynchronously and deduplicates Razorpay delivery retries using a `razorpay:event:{id}` Redis key (TTL 24h). Fixes the 5-second Razorpay webhook timeout risk.
- **COD Fraud Detection System** — end-to-end feature tracking COD cancellation behaviour:
  - `src/lib/util/cod-fraud.ts` — shared metadata reader/writer, block message formatter
  - `src/subscribers/cod-fraud-tracker.ts` — `order.canceled` subscriber: increments `cod_cancellations` strike on customer-initiated COD cancellations; sets `cod_blocked: true` after threshold; records a queued admin notification
  - `src/subscribers/cod-unlock-tracker.ts` — `order.placed` subscriber: decrements `cod_online_orders_needed` counter and auto-unlocks COD when the customer completes enough online-payment orders
  - `src/api/store/cod/eligibility/route.ts` — `GET /store/cod/eligibility` — COD availability check + block reason for checkout UI
  - `src/api/store/cod/cancellation-risk/route.ts` — `GET /store/cod/cancellation-risk/:id` — pre-cancellation risk warning for the customer
  - `src/api/store/cod/notifications/route.ts` — `GET /store/cod/notifications` — admin-queued toast messages, auto-cleared on read
  - `src/api/admin/custom/cod-fraud/route.ts` — `GET/POST /admin/custom/cod-fraud` — admin override: view stats, manually block/unblock customers
  - `src/admin/routes/cod-fraud/page.tsx` — Medusa Admin UI panel for COD fraud management
  - `src/admin/widgets/cod-fraud-widget.tsx` — order-detail widget showing COD risk badge
  - `src/modules/cod-payment/service.ts` — `initiatePayment()` now checks `cod_blocked` metadata and throws `NOT_ALLOWED` before creating a payment session
  - `src/api/store/orders/[id]/cancel/route.ts` — `POST /store/orders/:id/cancel` — customer self-cancellation endpoint; stamps `cancelled_by: "customer"` on the order so the fraud tracker can distinguish customer-initiated vs. admin-initiated cancellations
- **`src/lib/util/retry.ts`** — generic `retryWithBackoff(fn, { attempts, baseDelayMs, factor })` utility with configurable exponential backoff
- **`src/jobs/flush-search-buffer.ts`** — scheduled job (every 30 s) that drains a Redis set `search:buffer:pending` and calls the sync workflow once for all buffered product IDs as a single batch

### Fixed 🐛
- **Shiprocket transient failures**: `src/modules/shiprocket-fulfillment/service.ts` — all three Shiprocket API steps (createOrder, generateAWB, schedulePickup) are now wrapped with `retryWithBackoff` (3 attempts, 2s/4s/8s). Expired auth tokens are refreshed transparently by `getHeaders()` on each attempt.
- **Shiprocket missing AWB guard**: `src/services/shiprocket.ts` — `generateAWB()` now throws `MedusaError(UNEXPECTED_STATE)` if the response body contains no `awb_code`, instead of silently returning `undefined` and creating an untrackable fulfillment record.
- **Admin navigation (SPA routing)**: `src/admin/lib/razorpay-shared.tsx` and `src/admin/routes/razorpay/page.tsx` — replaced all `window.location.href = ...` calls with React Router `useNavigate()`. Prevents full-page reloads and loss of Admin SPA state on hotkey navigation.

### Changed 🔄
- **`src/subscribers/product-sync.ts`** — refactored from direct workflow call to Redis buffer (`SADD search:buffer:pending <id>`). 100 rapid product updates now trigger 1 sync batch instead of 100 individual workflow executions.
- **`src/api/hooks/razorpay/route.ts`** — reduced to ~40 LOC (HMAC verify + enqueue). All event routing logic (refund email, payment logging) moved to `src/modules/razorpay-queue/processor.ts`.
- **`medusa-config.ts`** — registered `razorpay-queue` as a custom module. Documented BullMQ Worker architecture, Redis requirement, and per-event idempotency in inline comments.
- **`package.json`** — added `bullmq@5.70.1` runtime dependency.
- Security tooling: `eslint-plugin-security`, `eslint-plugin-no-secrets`, `secretlint`, `@typescript-eslint` devDependencies
- `.eslintrc-security.js` — security-focused ESLint config with rules for Math.random, eval, ReDoS, timing-unsafe comparisons, deprecated crypto, secret detection
- `.secretlintrc.json` — secretlint config using recommended preset
- `BUGS.md` — living vulnerability tracker with 12 initial findings from security audit
- `CHANGELOG.md` — this file
- `SECURITY_ANALYSIS.md` — full security analysis report
- `src/scripts/create-meilisearch-scoped-key.ts` — one-time setup script for Meilisearch scoped key (BUG-001 fix)
- `package.json` `security:*` scripts: `security:audit`, `security:eslint`, `security:secrets`, `security:idor`, `security:timing`, `security:math-random`, `security:full`, `precommit`, `prepush`

### Environment Variables Added ⚙️
_(add to `.env` and `ENVIRONMENT_VARIABLE_REFERENCE` in `system-flow.md` before deploying)_
- `REDIS_URL` — already required; now also used by Razorpay BullMQ Worker (same connection string)
- No new env vars introduced in this batch; all features use existing `REDIS_URL`, `RAZORPAY_WEBHOOK_SECRET`, and customer module

---

## [1.0.0] — 2026-02-25 (Initial Audit)

### Security 🔐
- Identified 12 vulnerabilities via security audit (see BUGS.md)
- Confirmed secure patterns: HMAC webhook verification, timingSafeEqual comparisons, auth_context IDOR prevention, OTP HMAC storage, fail-closed webhook guards
- Added security tooling: ESLint security rules, VS Code security tasks, Copilot agent instructions

### Known Open Issues
- BUG-001: Meilisearch master key in production (Critical)
- BUG-002: Shiprocket webhook token logged in access logs (Critical)
- BUG-003: Cart completion race condition (Critical)
- BUG-004: No rate limiting on auth endpoints (High)
- BUG-005: Refund email silent failure at >500 payments (High)
- BUG-006: COD OTP rate limit bypassed on Redis outage (High)
- BUG-007: Google OAuth CSRF state validation needs verification (High)
- BUG-008: Shiprocket fulfillment failure not alerted (High)
- BUG-009: Multi-instance in-memory cache breakage (High)
- BUG-010: Order cancellation not propagated to Shiprocket (Medium)
- BUG-011: Duplicate product reviews allowed (Low)
- BUG-012: No request body size limits (Medium)

---

<!-- 
## Template for New Releases

## [X.Y.Z] — YYYY-MM-DD

### Security 🔐
- security(scope): description [BUG-XXX]

### Fixed 🐛
- fix(scope): description [BUG-XXX]

### Added ✨
- feat(scope): description

### Changed 🔄
- refactor(scope): description

### Breaking Changes ⚠️
- description of breaking change

-->
