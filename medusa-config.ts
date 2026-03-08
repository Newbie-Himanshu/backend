import { loadEnv, defineConfig } from '@medusajs/framework/utils'
import { Modules, ContainerRegistrationKeys } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// ── Production secret guard ────────────────────────────────────────────────
// Fail loudly if the server is started in production with default secrets.
if (process.env.NODE_ENV === 'production') {
    const INSECURE_DEFAULTS = ['supersecret', 'secret', 'changeme', 'change_me', '']
    if (INSECURE_DEFAULTS.includes(process.env.JWT_SECRET ?? 'supersecret')) {
        throw new Error(
            '[SECURITY] JWT_SECRET is not set or uses an insecure default. '
            + 'Set a strong random value in your production .env file. '
            + 'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
        )
    }
    if (INSECURE_DEFAULTS.includes(process.env.COOKIE_SECRET ?? 'supersecret')) {
        throw new Error(
            '[SECURITY] COOKIE_SECRET is not set or uses an insecure default. '
            + 'Set a strong random value in your production .env file.'
        )
    }
} else if (!process.env.JWT_SECRET) {
    console.warn(
        '[SECURITY WARNING] JWT_SECRET is not set — using insecure default. '
        + 'This is acceptable in development but MUST be changed before going to production.'
    )
}

// ── Load Balancer Security Check (Added) ─────────────────────────────────────
// Warn if running in production without trusting the upstream proxy.
// Without this, rate limiters (auth/OTP) will see the Load Balancer's IP
// instead of the real user IP, potentially banning EVERYONE at once.
if (process.env.NODE_ENV === 'production' && process.env.TRUST_PROXY !== 'true' && !process.env.TRUSTED_PROXY_IPS) {
  console.warn(
    '\x1b[33m%s\x1b[0m', // Yellow color for visibility
    '[SECURITY WARNING] TRUST_PROXY is not enabled in production. ' +
    'If you are behind a Load Balancer (Railway/Vercel/AWS), rate limits will ban the router IP, ' +
    'blocking ALL users. Set TRUST_PROXY="true" in your .env immediately.'
  )
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  // ── Official Marketplace Plugins ───────────────────────────────────────────
  // These replace custom module builds for Variant Images, Product Reviews, SEO Alt.
  plugins: [
    // Variant Images: stores images per product variant in metadata
    // Source: https://medusajs.com/integrations/medusa-variant-images/
    {
      resolve: "medusa-variant-images",
      options: {},
    },
    // Product Reviews: ratings, moderation workflow, admin responses
    // Source: https://medusajs.com/integrations/lambdacurry-product-reviews/
    {
      resolve: "@lambdacurry/medusa-product-reviews",
      options: {
        // 'pending' = admin must approve before review is public
        // 'approved' = auto-approve (default)
        defaultReviewStatus: "pending",
      },
    },
    // SEO Image Alt: manage alt_text on product images via admin widgets
    // Source: https://medusajs.com/integrations/alpha-solutions-image-alt/
    {
      resolve: "@alpha-solutions/medusa-image-alt",
      options: {},
    },
    // PDF Documents (Invoices + Packing Slips) — admin UI widget on Orders
    // Generate & download invoices from Orders → ⋯ → Generate invoice
    // Set store address in Documents → Settings before first use.
    // Source: https://medusajs.com/integrations/rsc-labs-medusa-documents-v2/
    {
      resolve: "@rsc-labs/medusa-documents-v2",
      options: {
        // Optional: set document language (default: 'en')
        // document_language: 'en',
      },
    },
    // Webhooks: send real-time HTTP notifications to external services on Medusa events.
    // Manage webhook endpoints via admin → Webhooks (or POST /admin/webhooks).
    // Add events you want to expose in `subscriptions` below.
    // Source: https://medusajs.com/integrations/lambdacurry-webhooks/
    {
      resolve: "@lambdacurry/medusa-webhooks",
      options: {
        subscriptions: [
          "order.placed",
          "order.canceled",
          "order.fulfillment_created",
          "customer.created",
          "product.created",
          "product.updated",
        ],
      },
    },
    // Automations: rule-based workflows triggered by events, schedules, or manual actions.
    // Create automations in admin → Notifications → Automations.
    // Supports email, Slack, and custom actions with if/then condition rules.
    // Source: https://medusajs.com/integrations/@codee-automations/
    {
      resolve: "@codee-sh/medusa-plugin-automations",
      options: {},
    },
    // Google Analytics 4 — server-side ecommerce event tracking via Measurement Protocol
    // Automatically tracks: add_to_cart, remove_from_cart, add_shipping_info, add_payment_info, purchase
    // Client-side events (view_item, begin_checkout, sign_up, login) must be tracked by the storefront.
    // Get Measurement ID: GA4 Property → Data Streams → your stream → Measurement ID
    // Get API Secret:     GA4 Property → Data Streams → Measurement Protocol API secrets → Create
    // Source: https://medusajs.com/integrations/variablevic-google-analytics/
    // NOTE: Only loaded when GA_MEASUREMENT_ID + GA_API_SECRET are set in .env
    ...(process.env.GA_MEASUREMENT_ID && process.env.GA_API_SECRET
      ? [
          {
            resolve: "@variablevic/google-analytics-medusa",
            options: {
              measurementId: process.env.GA_MEASUREMENT_ID, // e.g. "G-XXXXXXXXXX"
              apiSecret: process.env.GA_API_SECRET,
              // debug: true logs events to console WITHOUT sending them to GA.
              // Automatically true outside production so you never pollute real data in dev.
              debug: process.env.NODE_ENV !== "production",
            },
          },
        ]
      : []),
  ],
  modules: [
    // ── Custom: FAQ Queries Module ───────────────────────────────────────────
    // Stores customer-submitted support questions.
    // Customers POST to /store/faq-queries (public, rate-limited).
    // Admins read and answer queries from Admin → FAQ Queries (custom route).
    {
      resolve: "./src/modules/faq-queries",
    },
    // ── Custom: FAQ Articles Module ──────────────────────────────────────────
    // Stores help center FAQ articles (add/edit/delete/hide/visibility).
    // Public store API: GET /store/faq-articles (fetch visible articles).
    // Admin API: GET/POST /admin/faq-articles (manage articles).
    // Admin UI: /app/faq-queries → "FAQ Articles" tab (manage with modal forms).
    {
      resolve: "./src/modules/faq-articles",
    },
    // ── Custom: Wishlist Module ──────────────────────────────────────────────
    // WishlistItem entity linked to Customer & Product via src/links/
    {
      resolve: "./src/modules/wishlist",
    },
    // ── Custom: Shipping Config Module ──────────────────────────────────────
    // Admin-editable surcharge %, handling fee, fallback rate, free-shipping
    // threshold. Read by ShiprocketFulfillmentService.calculatePrice.
    // Manage via Admin → Shipping Config page.
    {
      resolve: "./src/modules/shipping-config",
    },
    // ── Custom: Razorpay Event Queue ────────────────────────────────────
    // Starts a BullMQ Worker that processes Razorpay webhook payloads asynchronously.
    // The POST /hooks/razorpay endpoint enqueues events after HMAC verification and
    // returns 200 immediately. The Worker processes events with 3-attempt retry,
    // exponential backoff, and per-event idempotency (razorpay:event:{id} Redis key).
    // Requires: REDIS_URL must be set (same value as Medusa’s own event bus).
    {
      resolve: "./src/modules/razorpay-queue",
    },
    // ── Custom: Algolia Search Module ────────────────────────────────────────
    // Indexes products in Algolia on create/update/delete events.
    // Provider selection managed via Admin → Search Engine.
    // Get credentials: https://dashboard.algolia.com/account/api-keys
    {
      resolve: "./src/modules/algolia",
      options: {
        appId: process.env.ALGOLIA_APP_ID!,
        apiKey: process.env.ALGOLIA_API_KEY!,
        productIndexName: process.env.ALGOLIA_PRODUCT_INDEX_NAME!,
      },
    },

    // ── Custom: Meilisearch Search Module ─────────────────────────────────────
    // Indexes products in Meilisearch on create/update/delete events.
    // Provider selection managed via Admin → Search Engine.
    // Self-hosted: https://www.meilisearch.com/docs/learn/getting_started/quick_start
    // Cloud: https://cloud.meilisearch.com
    //
    // SECURITY (BUG-001): MEILISEARCH_API_KEY MUST be a scoped key — NOT the master key.
    // Required permissions: documents.add, documents.get, documents.delete,
    //                       indexes.search, indexes.update
    // Restricted to: the products index only.
    //
    // To create the scoped key (one-time setup):
    //   1. Add MEILISEARCH_MASTER_KEY=<your-master-key> to .env temporarily
    //   2. Run: yarn medusa exec ./src/scripts/create-meilisearch-scoped-key.ts
    //   3. Copy the printed key → MEILISEARCH_API_KEY in .env
    //   4. Remove MEILISEARCH_MASTER_KEY from .env
    {
      resolve: "./src/modules/meilisearch",
      options: {
        host: process.env.MEILISEARCH_HOST!,
        apiKey: process.env.MEILISEARCH_API_KEY!,
        productIndexName: process.env.MEILISEARCH_PRODUCT_INDEX_NAME!,
      },
    },
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          // ── Razorpay (UPI, Cards, NetBanking, Wallets) ──
          {
            resolve: "medusa-plugin-razorpay-v2/providers/payment-razorpay/src",
            id: "razorpay",
            options: {
              key_id: process.env.RAZORPAY_KEY_ID,
              key_secret: process.env.RAZORPAY_KEY_SECRET,
              razorpay_account: process.env.RAZORPAY_ACCOUNT || "",
              automatic_expiry_period: 30,
              manual_expiry_period: 20,
              refund_speed: "normal",
              webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET,
            },
          },
          // ── Cash on Delivery ──
          {
            resolve: "./src/modules/cod-payment",
            id: "cod",
            options: {
              min_order_amount: 10000,   // ₹100 in paise
              max_order_amount: 5000000, // ₹50,000 in paise
              // No daily-order or new-customer limits — all COD orders accepted.
              otp_threshold: 250000,     // ₹2,500 in paise — OTP required for orders at or above this amount
            },
          },
        ],
      },
    },
    // ── Resend Transactional Email ──────────────────────────────────────
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "./src/modules/resend",
            id: "resend",
            options: {
              channels: ["email"],
              api_key:  process.env.RESEND_API_KEY,
              from:     process.env.RESEND_FROM_EMAIL,
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/fulfillment-manual",
            id: "manual",
          },
          {
            resolve: "./src/modules/shiprocket-fulfillment",
            id: "shiprocket",
            options: {},
          },
        ],
      },
    },
    // ── Auth Module — emailpass + Google OAuth ──────────────────────────────
    {
      resolve: "@medusajs/medusa/auth",
      dependencies: [Modules.CACHE, ContainerRegistrationKeys.LOGGER],
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/auth-emailpass",
            id: "emailpass",
          },
          {
            resolve: "@medusajs/medusa/auth-google",
            id: "google",
            options: {
              clientId:     process.env.GOOGLE_API_CLIENT_ID,
              clientSecret: process.env.GOOGLE_API_CLIENT_SECRET,
              // After Google authenticates the user it redirects here.
              // On this page the storefront calls /auth/customer/google/callback.
              callbackUrl:  process.env.GOOGLE_CALLBACK_URL,
            },
          },
        ],
      },
    },
    // ── File Module — Digital Ocean Spaces (S3-compatible) ─────────────────────
    // Stores all application files in Digital Ocean Spaces
    // Product images, variant images, documents, etc. are uploaded to DO Spaces.
    // Requires: DO_SPACES_ACCESS_KEY, DO_SPACES_SECRET_KEY,
    //           DO_SPACES_BUCKET, DO_SPACES_REGION, DO_SPACES_ENDPOINT
    // Get credentials from: https://cloud.digitalocean.com/spaces
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-s3",
            id: "do-spaces",
            options: {
              // Digital Ocean Spaces credentials
              access_key_id: process.env.DO_SPACES_ACCESS_KEY || process.env.DO_SPACES_ACCESS_KEY_ID,
              secret_access_key: process.env.DO_SPACES_SECRET_KEY || process.env.DO_SPACES_SECRET_ACCESS_KEY,
              region: process.env.DO_SPACES_REGION,
              bucket: process.env.DO_SPACES_BUCKET || process.env.DO_SPACES_SPACE_NAME,
              // Digital Ocean Spaces S3-compatible endpoint
              endpoint: process.env.DO_SPACES_ENDPOINT,
              // Ensures file URLs use the custom endpoint instead of S3 defaults
              forcePathStyle: true,
              // ACL for uploaded files (public-read allows direct access via URL)
              acl: "public-read",
            },
          },
        ],
      },
    },
  ],
})