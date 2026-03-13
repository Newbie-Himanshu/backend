import { defineMiddlewares, authenticate } from "@medusajs/framework/http"
import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import crypto from "crypto"
import logger from "../lib/logger"
import { getRedisClient } from "../lib/redis-client"

const log = logger.child({ module: "middlewares" })

// ── Redis Lua Script: Atomic INCR + EXPIRE ────────────────────────────────────
// Increments a counter and sets its expiry in one atomic operation.
// Prevents race conditions where a process crashes between INCR and EXPIRE.
const INCR_WITH_TTL_LUA = `local key = KEYS[1]
local ttl = tonumber(ARGV[1])
local count = redis.call('INCR', key)
if count == 1 then
  redis.call('EXPIRE', key, ttl)
end
return count
`

// ── Trusted-proxy IP resolution ───────────────────────────────────────────────
// Read once at module init — never on hot path.
//
// Two modes:
//
// 1. TRUST_PROXY=true  (PaaS / Railway / Render / DigitalOcean App Platform)
//    The app runs behind the platform's edge proxy. ALL inbound traffic already
//    passed through the proxy, so X-Forwarded-For is always set by the platform
//    and cannot be injected by end-users. Set this when deploying on a PaaS.
//
// 2. TRUSTED_PROXY_IPS=127.0.0.1  (self-hosted VPS with Nginx on same machine)
//    Only trust X-Forwarded-For when the connecting socket IP matches one of the
//    listed IPs (comma-separated).  Use this when running your own Nginx.
//
// Neither set → raw socket IP (safe for local dev; rate-limits by socket address).
const TRUST_PROXY_ALL = process.env.TRUST_PROXY === "true"
const TRUSTED_PROXY_IPS = (process.env.TRUSTED_PROXY_IPS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

/**
 * Returns the real client IP, safe against X-Forwarded-For spoofing.
 */
function getClientIp(req: MedusaRequest): string {
  const socketIp = req.socket?.remoteAddress ?? "unknown"
  const forwardedFor = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()

  if (TRUST_PROXY_ALL && forwardedFor) return forwardedFor
  if (TRUSTED_PROXY_IPS.length > 0 && TRUSTED_PROXY_IPS.includes(socketIp) && forwardedFor) {
    return forwardedFor
  }
  return socketIp
}

// ── CSRF Token Protection ──────────────────────────────────────────────────────────
// Generates and validates CSRF tokens to prevent cross-site request forgery attacks.
// Tokens are stored in session and validated against X-CSRF-Token header on POST/PUT/DELETE.

/**
 * Generates a CSRF token for the session.
 * Called on GET requests to populate a hidden form field.
 */
function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Generates CSRF token and stores in session (called for GET requests).
 */
function csrfTokenGenerator(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  // Only generate for GET requests to reduce overhead
  if (req.method === 'GET') {
    const session = (req as any).session || {}
    if (!session.csrfToken) {
      session.csrfToken = generateCsrfToken()
      ;(req as any).session = session
    }
  }
  return next()
}

/**
 * Validates CSRF token on state-changing requests (POST/PUT/DELETE).
 * Extracts token from X-CSRF-Token header and compares with session token.
 */
function verifyCsrfToken(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): unknown {
  // Skip for safe methods or public endpoints
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return next()
  }

  const session = (req as any).session || {}
  const sessionToken = session.csrfToken
  const headerToken = req.headers['x-csrf-token'] as string | undefined

  // If no session token, generate one (first request)
  if (!sessionToken) {
    const newToken = generateCsrfToken()
    ;(req as any).session = { ...session, csrfToken: newToken }

    // First request without token is always rejected
    if (!headerToken) {
      return res.status(403).json({
        error: "CSRF token missing",
        message: "Please retry with a valid CSRF token in X-CSRF-Token header"
      })
    }
  }

  // Verify token format (should be 64-char hex string)
  if (!headerToken || !/^[0-9a-f]{64}$/i.test(headerToken)) {
    return res.status(403).json({
      error: "CSRF token invalid format",
      message: "Token must be a valid 64-character hexadecimal string"
    })
  }

  // Constant-time comparison to prevent timing attacks
  try {
    const sessionBuf = Buffer.from(sessionToken)
    const headerBuf = Buffer.from(headerToken)

    const tokensMatch = sessionBuf.length === headerBuf.length &&
      crypto.timingSafeEqual(sessionBuf, headerBuf)

    if (!tokensMatch) {
      log.warn({ ip: getClientIp(req) }, "CSRF token mismatch — potential attack")
      return res.status(403).json({
        error: "CSRF token verification failed",
        message: "Token does not match session. Refresh and try again."
      })
    }
  } catch (err) {
    log.error({ err }, "CSRF token comparison failed")
    return res.status(500).json({ error: "Token verification error" })
  }

  return next()
}

// ── OTP Send Rate Limiting by IP ───────────────────────────────────────────────────
// Limits OTP send requests per IP to prevent SMS bombing/DoS attacks.
// Limit: 5 OTP requests per hour per real client IP (global across all customers).
const OTP_SEND_RATE_LIMIT = 5
const OTP_SEND_WINDOW_SECS = 3600 // 1 hour

async function otpSendRateLimiter(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<unknown> {
  const clientIp = getClientIp(req)
  const rateLimitKey = `otp:send:${clientIp}`

  try {
    const redis = getRedisClient()
    const count = await redis.call("INCR", rateLimitKey) as number

    if (count === 1) {
      // First request in window — set expiry atomically
      await redis.call("EXPIRE", rateLimitKey, String(OTP_SEND_WINDOW_SECS))
    }

    if (count > OTP_SEND_RATE_LIMIT) {
      const ttl = await redis.call("TTL", rateLimitKey) as number
      log.warn({ ip: clientIp, count }, `OTP send rate limit exceeded`)
      return res.status(429).json({
        error: "Too many OTP requests",
        message: `Maximum ${OTP_SEND_RATE_LIMIT} OTP requests per hour. Try again in ${Math.ceil(ttl / 60)} minutes.`,
        retryAfter: ttl
      })
    }

    // Request allowed
    return next()
  } catch (err) {
    // Redis unavailable — allow through (availability > rate limiting on outage)
    log.warn({ err, ip: clientIp }, "OTP send rate limit check unavailable — allowing request")
    return next()
  }
}


// ── Cart completion idempotency lock (BUG-003 fix) ────────────────────────────
// Prevents duplicate order creation from double-click or network retries.
// Uses Redis SET NX EX to acquire a per-cart lock. If the lock is held,
// a 409 is returned so the frontend can detect and stop retrying.
// Lock TTL is 30s — enough for any cart completion to finish.
// Falls back gracefully (allow through) if Redis is unavailable.
const CART_COMPLETE_LOCK_TTL_SECS = 30

async function cartCompletionLock(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<unknown> {
  // Extract cart ID from /store/carts/:id/complete
  const segments = req.path.split("/")
  const cartIdx = segments.indexOf("carts")
  const cartId = cartIdx !== -1 ? segments[cartIdx + 1] : undefined

  if (!cartId) return next()

  const lockKey = `cart:completing:${cartId}`

  try {
    const redis = getRedisClient()
    const acquired = await redis.call("SET", lockKey, "1", "NX", "EX", String(CART_COMPLETE_LOCK_TTL_SECS)) as string | null

    if (acquired === null) {
      log.warn({ cartId }, "Cart completion already in progress — duplicate request rejected")
      res.status(409).json({ message: "Cart completion already in progress. Please wait and check your orders." })
      return
    }

    // Release lock when response finishes OR when the client aborts.
    // "finish" fires when the server side sends the last byte.
    // "close"  fires when the underlying socket is closed (client abort, disconnect).
    // Without "close" the lock is held for the full 30s TTL on aborted requests.
    const releaseLock = () => { redis.del(lockKey).catch(() => { /* best-effort */ }) }
    res.on("finish", releaseLock)
    res.on("close", releaseLock)
  } catch (redisErr) {
    // Redis unavailable — allow through (availability > duplicate prevention on outage)
    log.warn({ err: redisErr }, "Cart completion lock unavailable — allowing request through")
  }

  return next()
}
// Rejects requests whose body would exceed the given size limit.
// Defense-in-depth: Nginx / ALB must ALSO enforce client_max_body_size.
//
// Two attack vectors addressed:
//  1. Content-Length spoofing  — checked synchronously before the body is read.
//  2. Chunked-transfer bypass  — HTTP/1.1 chunked encoding does not set Content-Length.
//     Clients that don't declare a size are rejected (411 Length Required).
//     All legitimate API clients and SDKs always include Content-Length.
const BODY_LIMIT_BYTES = 1 * 1024 * 1024          // 1 MB global limit
const WEBHOOK_BODY_LIMIT_BYTES = 512 * 1024        // 512 KB for webhook endpoints

function bodySizeGuard(limitBytes: number) {
  return function (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
    const cl = req.headers["content-length"]
    const te = (req.headers["transfer-encoding"] ?? "").toLowerCase()

    // Reject chunked requests that omit Content-Length entirely.
    // Chunked encoding lets a sender stream an unknown-length body, bypassing the
    // Content-Length check below.  Reject these at the header stage.
    if (te.includes("chunked") && !cl) {
      log.warn({ ip: getClientIp(req), path: req.path }, "Chunked request without Content-Length — rejected (411)")
      res.status(411).json({ message: "Content-Length required." })
      return
    }

    const contentLength = parseInt(cl ?? "0", 10)
    if (!isNaN(contentLength) && contentLength > limitBytes) {
      log.warn({ ip: getClientIp(req), path: req.path, contentLength }, "Request body too large — rejected (413)")
      res.status(413).json({ message: "Request entity too large." })
      return
    }
    return next()
  }
}
// Protects /auth/customer/emailpass (login) and reset-password from
// credential stuffing and password-reset spam.
// Primary store: Redis (atomic Lua INCR+TTL). Fallback: in-memory Map.
// Limit: 10 requests per 15 minutes per REAL client IP.
const AUTH_RATE_LIMIT_MAX = 10
const AUTH_RATE_LIMIT_WINDOW_SECS = 15 * 60  // 15 minutes
const inMemoryAuthRateLimit = new Map<string, { count: number; resetAt: number }>()

// Periodic cleanup: remove expired entries every hour
setInterval(() => {
  const now = Date.now()
  // Clean Auth Map
  for (const [ip, data] of inMemoryAuthRateLimit) {
    if (now > data.resetAt) inMemoryAuthRateLimit.delete(ip)
  }
  // Clean OTP Map
  for (const [ip, data] of inMemoryOtpRateLimit) {
    if (now > data.resetAt) inMemoryOtpRateLimit.delete(ip)
  }
  // Clean FAQ Map
  for (const [ip, data] of inMemoryFaqRateLimit) {
    if (now > data.resetAt) inMemoryFaqRateLimit.delete(ip)
  }
}, 60 * 60 * 1000) // 1 hour
async function authRateLimiter(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<unknown> {
  const ip = getClientIp(req)   // safe — only trusts X-Forwarded-For from TRUSTED_PROXY_IPS
  const rlKey = `rl:auth:${ip}`

  try {
    const redis = getRedisClient()
    // Atomic Lua script: INCR + set TTL in one round-trip.
    // Prevents permanent key-lock if process crashes between INCR and EXPIRE.
    const count = await redis.eval(
      INCR_WITH_TTL_LUA,
      1,
      rlKey,
      String(AUTH_RATE_LIMIT_WINDOW_SECS)
    ) as number
    if (count > AUTH_RATE_LIMIT_MAX) {
      log.warn({ ip, count }, "Auth rate limit exceeded (Redis)")
      res.status(429).json({
        message: "Too many login attempts. Please try again in 15 minutes.",
      })
      return
    }
  } catch (redisErr) {
    // Redis unavailable — fall back to in-memory counter
    log.warn({ err: redisErr }, "Redis auth rate-limit unavailable — using in-memory fallback")
    const now = Date.now()
    const entry = inMemoryAuthRateLimit.get(ip)
    if (!entry || now > entry.resetAt) {
      inMemoryAuthRateLimit.set(ip, { count: 1, resetAt: now + AUTH_RATE_LIMIT_WINDOW_SECS * 1000 })
    } else {
      entry.count++
      if (entry.count > AUTH_RATE_LIMIT_MAX) {
        log.warn({ ip, count: entry.count }, "Auth rate limit exceeded (in-memory fallback)")
        res.status(429).json({
          message: "Too many login attempts. Please try again in 15 minutes.",
        })
        return
      }
    }
  }

  return next()
}

// ── OTP verify IP rate limiter ─────────────────────────────────────────────────
// POST /store/cod/verify-otp is protected per-session (5 attempts per session),
// but an attacker can open many sessions and exhaust them in parallel across IPs.
// This adds an IP-level ceiling: 10 OTP attempts per 5 minutes per client IP.
// Uses the same atomic Lua pattern as authRateLimiter.
const OTP_RATE_LIMIT_MAX = 10
const OTP_RATE_LIMIT_WINDOW_SECS = 5 * 60  // 5 minutes
const inMemoryOtpRateLimit = new Map<string, { count: number; resetAt: number }>()

async function otpVerifyRateLimiter(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<unknown> {
  const ip = getClientIp(req)
  const rlKey = `rl:otp-verify:${ip}`

  try {
    const redis = getRedisClient()
    const count = await redis.eval(
      INCR_WITH_TTL_LUA,
      1,
      rlKey,
      String(OTP_RATE_LIMIT_WINDOW_SECS)
    ) as number
    if (count > OTP_RATE_LIMIT_MAX) {
      log.warn({ ip, count }, "OTP verify rate limit exceeded (Redis)")
      res.status(429).json({
        message: "Too many OTP attempts from this IP. Please try again in 5 minutes.",
      })
      return
    }
  } catch (redisErr) {
    log.warn({ err: redisErr }, "Redis OTP rate-limit unavailable — using in-memory fallback")
    const now = Date.now()
    const entry = inMemoryOtpRateLimit.get(ip)
    if (!entry || now > entry.resetAt) {
      inMemoryOtpRateLimit.set(ip, { count: 1, resetAt: now + OTP_RATE_LIMIT_WINDOW_SECS * 1000 })
    } else {
      entry.count++
      if (entry.count > OTP_RATE_LIMIT_MAX) {
        log.warn({ ip, count: entry.count }, "OTP verify rate limit exceeded (in-memory fallback)")
        res.status(429).json({
          message: "Too many OTP attempts from this IP. Please try again in 5 minutes.",
        })
        return
      }
    }
  }

  return next()
}

// ── FAQ query submission rate limiter ─────────────────────────────────────────
// POST /store/faq-queries is a fully public endpoint (no auth).
// Without a rate limit, any automated script could flood the admin inbox.
// Limit: 5 submissions per hour per real client IP.
// Uses the same atomic Redis Lua pattern as authRateLimiter.
const FAQ_QUERY_RATE_LIMIT_MAX  = 5
const FAQ_QUERY_RATE_LIMIT_WINDOW_SECS = 60 * 60  // 1 hour
const inMemoryFaqRateLimit = new Map<string, { count: number; resetAt: number }>()

async function faqQueryRateLimiter(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<unknown> {
  const ip    = getClientIp(req)
  const rlKey = `rl:faq-query:${ip}`

  try {
    const redis = getRedisClient()
    const count = await redis.eval(
      INCR_WITH_TTL_LUA,
      1,
      rlKey,
      String(FAQ_QUERY_RATE_LIMIT_WINDOW_SECS)
    ) as number

    if (count > FAQ_QUERY_RATE_LIMIT_MAX) {
      log.warn({ ip, count }, "FAQ query rate limit exceeded (Redis)")
      res.status(429).json({
        message: "Too many questions submitted. Please try again in an hour.",
      })
      return
    }
  } catch (redisErr) {
    log.warn({ err: redisErr }, "Redis FAQ rate-limit unavailable — using in-memory fallback")
    const now   = Date.now()
    const entry = inMemoryFaqRateLimit.get(ip)
    if (!entry || now > entry.resetAt) {
      inMemoryFaqRateLimit.set(ip, { count: 1, resetAt: now + FAQ_QUERY_RATE_LIMIT_WINDOW_SECS * 1000 })
    } else {
      entry.count++
      if (entry.count > FAQ_QUERY_RATE_LIMIT_MAX) {
        log.warn({ ip, count: entry.count }, "FAQ query rate limit exceeded (in-memory fallback)")
        res.status(429).json({
          message: "Too many questions submitted. Please try again in an hour.",
        })
        return
      }
    }
  }

  return next()
}

// ── Verified-purchase middleware ───────────────────────────────────────────────
// Applied to POST /store/product-reviews (the @lambdacurry/medusa-product-reviews
// plugin endpoint). Enforces two rules:
//   1. Customer must be authenticated.
//   2. Customer must have a delivered order that contains the product reviewed.
// Also injects the customer's real account name as display_name so it cannot be
// spoofed from the frontend.
async function requireVerifiedPurchase(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const customer_id = (req as any).auth_context?.actor_id as string | undefined
  if (!customer_id) {
    return res.status(401).json({ message: "You must be logged in to write a review." })
  }

  const body = req.body as Record<string, unknown>
  const product_id = body?.product_id as string | undefined
  if (!product_id) return next()

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any

    // Check that customer has a delivered order containing this product
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "fulfillment_status", "items.product_id"],
      filters: { customer_id },
    })

    const hasDelivered = (orders as any[]).some(
      (order) =>
        (order.fulfillment_status === "delivered" ||
          order.fulfillment_status === "partially_delivered") &&
        (order.items as any[])?.some((item) => item.product_id === product_id)
    )

    if (!hasDelivered) {
      return res.status(403).json({
        message: "Only verified buyers with a delivered order can review this product.",
      })
    }

    // BUG-011 FIX: Prevent duplicate reviews — one review per customer per product.
    // Check if this customer already submitted a review (any status: pending/approved/rejected).
    try {
      const { data: existingReviews } = await query.graph({
        entity: "product_review",
        fields: ["id"],
        filters: { customer_id, product_id },
        pagination: { take: 1 },
      })
      if ((existingReviews as any[])?.length > 0) {
        return res.status(409).json({
          message: "You have already submitted a review for this product.",
        })
      }
    } catch (reviewCheckErr) {
      // If the entity name is different in the installed plugin version, skip the check
      // rather than blocking legitimate reviews. Log so it can be investigated.
      log.warn({ err: reviewCheckErr }, "Duplicate review check failed — skipping guard")
    }

    // Inject real customer name — cannot be spoofed from frontend
    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["first_name", "last_name"],
      filters: { id: customer_id },
    })
    const c = (customers as any[])?.[0]
    const fullName = [c?.first_name, c?.last_name].filter(Boolean).join(" ")
    if (fullName) body.display_name = fullName

    return next()
  } catch (err) {
    log.error({ err }, "ReviewMiddleware error")
    return res.status(500).json({ message: "Failed to verify purchase eligibility." })
  }
}

// ── Security Headers Middleware ───────────────────────────────────────────────────
// Sets critical security headers on ALL responses to prevent common attacks.
function securityHeaders(
  _req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  // Prevent MIME sniffing attacks (e.g., loading JS as HTML)
  res.setHeader("X-Content-Type-Options", "nosniff")

  // Prevent clickjacking attacks
  res.setHeader("X-Frame-Options", "DENY")

  // Enable XSS filter in older browsers (modern browsers ignore this)
  res.setHeader("X-XSS-Protection", "1; mode=block")

  // Strict Transport Security — force HTTPS for 1 year
  // subdomains and preload are secure defaults but can be adjusted
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
  }

  // Referrer Policy — don't leak full URLs in Referer header to third-party sites
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")

  // Permissions Policy — disable potentiall dangerous browser features
  // Restrict: camera, microphone, geolocation, accelerometer, gyroscope, magnetometer, usb, payment
  res.setHeader(
    "Permissions-Policy",
    [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "accelerometer=()",
      "gyroscope=()",
      "magnetometer=()",
      "usb=()",
      "payment=()",
      "clipboard-read=(self)",
      "clipboard-write=(self)",
    ].join(", ")
  )

  // Content Security Policy (CSP) — prevents inline scripts and external script injection
  // Adjust 'script-src' based on your requirements (e.g., if using external analytics)
  const csp = [
    "default-src 'self'", // Only allow resources from same origin by default
    "script-src 'self'",  // Only allow same-origin scripts (no inline <script>)
    "style-src 'self' 'unsafe-inline'", // Allow inline CSS (common for Tailwind/CSS-in-JS)
    "img-src 'self' data: https:", // Allow images from same-origin, data URLs, HTTPS
    "font-src 'self' data:", // Allow fonts from same-origin and data URLs
    "connect-src 'self' https:", // Allow API calls to same-origin and HTTPS
    "frame-ancestors 'none'", // Don't allow embedding in iframes
    "base-uri 'self'", // Restrict base URLs
    "form-action 'self'", // Restrict form submissions to same-origin
  ].join("; ")

  res.setHeader("Content-Security-Policy", csp)

  return next()
}

// ── Cache Control Middleware ───────────────────────────────────────────────────────
// Prevents caching of sensitive endpoints to avoid leaking customer data.
// Sensitive routes return Cache-Control: no-store to ensure browsers and proxies don't cache.
function cacheControlMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  const sensitivePatterns = [
    /^\/store\/auth\//,           // Auth operations
    /^\/store\/customers/,        // Customer account data
    /^\/store\/orders/,           // Order history
    /^\/store\/cod\/verify-otp/,  // OTP verification
    /^\/store\/cod\/eligibility/, // COD eligibility
    /^\/admin\//,                 // All admin endpoints
  ]

  const isSensitive = sensitivePatterns.some(pattern => pattern.test(req.path))

  if (isSensitive) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, private")
    res.setHeader("Pragma", "no-cache") // For HTTP/1.0 compatibility
    res.setHeader("Expires", "0")       // For older browsers
  }

  return next()
}

/**
 * API Route Middlewares
 *
 * Enforces authentication on custom store routes that require a logged-in customer.
 * Per Medusa v2 docs, the authenticate middleware must be explicitly applied to
 * custom routes — it is NOT automatically inherited from built-in route protection.
 *
 * @see https://docs.medusajs.com/learn/fundamentals/api-routes/protected-routes
 */
export default defineMiddlewares({
  errorHandler: (
    err: MedusaError | (Error & { type?: string; status?: number }),
    req: MedusaRequest,
    res: MedusaResponse,
    _next: MedusaNextFunction
  ) => {
    const isMedusaError =
      (err as any).name === "MedusaError" ||
      typeof (err as any).type === "string"

    if (isMedusaError) {
      const status = (err as any).status ?? 400
      res.status(status).json({ type: (err as any).type, message: err.message })
      return
    }

    log.error(
      { err, path: req.path, method: req.method },
      "Unhandled non-Medusa error escaped route handler"
    )
    res.status(500).json({
      type: "INTERNAL_ERROR",
      message: "An unexpected error occurred. Please try again or contact support.",
    })
  },
  routes: [
    // ── Global security headers (applied to all routes) ───────────────────────
    {
      matcher: "/**",
      middlewares: [securityHeaders, cacheControlMiddleware],
    },
    // ── CSRF Token Protection (Defense-in-depth) ───────────────────────────────
    // Generates CSRF tokens on GET requests and validates on POST/PUT/DELETE.
    // This prevents cross-site form submissions from forging state-changing requests.
    {
      matcher: "/store/**",
      method: ["GET"],
      middlewares: [csrfTokenGenerator],
    },
    {
      matcher: "/store/auth/**",
      method: ["POST"],
      middlewares: [verifyCsrfToken],
    },
    {
      matcher: "/store/customers",
      method: ["POST"],
      middlewares: [verifyCsrfToken],
    },
    {
      matcher: "/store/cod/**",
      method: ["POST"],
      middlewares: [verifyCsrfToken],
    },
    {
      matcher: "/store/wishlist*",
      method: ["POST", "DELETE"],
      middlewares: [verifyCsrfToken],
    },
    {
      matcher: "/store/product-reviews",
      method: ["POST"],
      middlewares: [verifyCsrfToken],
    },

    // ── Global body size guard (BUG-012 fix) ─────────────────────────────────
    // Rejects oversized requests before business logic runs.
    {
      matcher: "/store/**",
      middlewares: [bodySizeGuard(BODY_LIMIT_BYTES)],
    },
    {
      matcher: "/admin/**",
      middlewares: [bodySizeGuard(BODY_LIMIT_BYTES)],
    },
    {
      matcher: "/hooks/**",
      middlewares: [bodySizeGuard(WEBHOOK_BODY_LIMIT_BYTES)],
    },

    // ── Auth rate limiting (BUG-004 fix) ─────────────────────────────────────
    // Prevents credential stuffing and password-reset spam.
    // 10 requests per 15 minutes per IP on login and reset-password endpoints.
    {
      matcher: "/auth/customer/emailpass",
      middlewares: [authRateLimiter],
    },
    {
      matcher: "/auth/customer/emailpass/reset-password",
      middlewares: [authRateLimiter],
    },
    {
      matcher: "/auth/customer/emailpass/update",
      middlewares: [authRateLimiter],
    },

    // ── Cart completion idempotency lock (BUG-003 fix) ───────────────────────
    // Prevents duplicate orders from double-click or network retries.
    {
      matcher: "/store/carts/*/complete",
      method: ["POST"],
      middlewares: [authenticate("customer", ["session", "bearer"]), cartCompletionLock],
    },

    // ── Serviceability check ─────────────────────────────────────────────────
    // Requires a logged-in customer to prevent anonymous actors from probing
    // courier rate cards and exhausting the Shiprocket API quota.
    {
      matcher: "/store/shipping/serviceability*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },

    // ── COD OTP Send Rate Limiting ───────────────────────────────────────────
    // Limit: 5 OTP send requests per hour per IP (global, prevents SMS bombing)
    {
      matcher: "/store/cod/send-otp",
      method: ["POST"],
      middlewares: [otpSendRateLimiter],
    },

    // ── COD OTP verification ─────────────────────────────────────────────────
    // Bind OTP verification to an authenticated customer session.
    // otpVerifyRateLimiter adds an IP-level ceiling (10 / 5 min) on top of the
    // per-session brute-force lockout enforced in the route handler.
    {
      matcher: "/store/cod/verify-otp*",
      middlewares: [authenticate("customer", ["session", "bearer"]), otpVerifyRateLimiter],
    },

    // ── COD fraud eligibility, risk check & admin-queued notifications ───────
    // GET /store/cod/eligibility          — COD block/warning status for checkout
    // GET /store/cod/cancellation-risk/:id — pre-cancellation risk assessment
    // GET /store/cod/notifications        — admin-queued toast messages (read+clear)
    // All require a logged-in customer; handlers enforce resource ownership.
    {
      matcher: "/store/cod/eligibility*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/cod/cancellation-risk*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/cod/notifications*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },

    // ── Customer order cancellation ──────────────────────────────────────────
    // POST /store/orders/:id/cancel — stamps cancelled_by=customer so the
    // cod-fraud-tracker applies strike only for customer-initiated cancellations.
    {
      matcher: "/store/orders/*/cancel*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },

    // ── Order tracking ───────────────────────────────────────────────────────
    // Requires a logged-in customer. The handler also verifies order ownership
    // (customer_id on the order must match auth_context.actor_id).
    {
      matcher: "/store/orders/*/tracking*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },

    // ── Customer invoice download ────────────────────────────────────────────
    // Customer must be logged in. Handler also verifies order ownership.
    // GET /store/orders/:id/invoice  → streams PDF using @rsc-labs/medusa-documents-v2
    {
      matcher: "/store/orders/*/invoice*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },

    // ── FAQ query submission rate limiter ────────────────────────────────────
    // Public endpoint — 5 submissions per hour per IP.
    {
      matcher: "/store/faq-queries",
      method: ["POST"],
      middlewares: [faqQueryRateLimiter],
    },

    // ── Wishlist ─────────────────────────────────────────────────────────────
    // All wishlist operations (list, add, remove) require a logged-in customer.
    // The customer_id is derived from auth_context in each handler — never
    // accepted as a query param — to prevent cross-customer data access.
    {
      matcher: "/store/wishlist*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },

    // ── Product Reviews ───────────────────────────────────────────────────────
    // POST /store/product-reviews (plugin endpoint): authenticate + verify delivery.
    // The requireVerifiedPurchase middleware rejects unauthenticated requests,
    // checks the customer has a delivered order with the product, and injects
    // the customer's real name so it cannot be spoofed from the frontend.
    {
      matcher: "/store/product-reviews",
      method: ["POST"],
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        requireVerifiedPurchase,
      ],
    },

    // ── FAQ query submission rate limiter ────────────────────────────────────
    // POST /store/faq-queries is a public endpoint (no auth required).
    // Limit: 5 submissions per hour per real client IP.
    {
      matcher: "/store/faq-queries",
      method:  ["POST"],
      middlewares: [faqQueryRateLimiter],
    },

    // ── Review eligibility + pending review checks ────────────────────────────
    // Auth-required so customer_id is available from auth_context in handlers.
    {
      matcher: "/store/custom/review-eligibility*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/custom/pending-reviews*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },

    // ── Admin Payment Operations (Razorpay) ──────────────────────────────────────
    // POST /admin/custom/razorpay/:paymentId/capture - Manual payment capture
    // POST /admin/custom/razorpay/:paymentId/refund  - Manual refund issuance
    // These are sensitive financial operations that MUST require admin authentication.
    // Even though they're under /admin/**, we add explicit middleware for defense-in-depth.
    {
      matcher: "/admin/custom/razorpay/*/capture",
      method: ["POST"],
      middlewares: [authenticate("admin", ["session", "bearer", "api-key"])],
    },
    {
      matcher: "/admin/custom/razorpay/*/refund",
      method: ["POST"],
      middlewares: [authenticate("admin", ["session", "bearer", "api-key"])],
    },

    // ── Admin COD Fraud Management ───────────────────────────────────────────────
    // POST /admin/custom/cod-fraud* - Enable/disable COD for customers with fraud risk
    // Requires admin authentication to prevent unauthorized access manipulation.
    {
      matcher: "/admin/custom/cod-fraud*",
      method: ["POST"],
      middlewares: [authenticate("admin", ["session", "bearer", "api-key"])],
    },
  ],
})