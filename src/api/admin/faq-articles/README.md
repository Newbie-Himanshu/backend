/**
 * FAQ Management API Endpoints Documentation
 *
 * All endpoints are organized by scope (admin/store) and include examples.
 * Admin endpoints are protected by Medusa's session guard and require valid admin credentials.
 * Store endpoints are public with rate limiting applied.
 */

// ───────────────────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS (Protected - Admin Dashboard)
// ───────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/faq-articles
 *
 * List all FAQ articles with optional filtering and pagination
 *
 * Query Parameters:
 *   section     string     "buying" | "shipping" | "payments" | "account" | "community" | "trust" (optional)
 *   visibility  string     "all" | "visible" | "hidden" (default: "all")
 *   limit       number     1-200 (default: 50)
 *   offset      number     Starting position (default: 0)
 *
 * Example Request:
 *   GET /admin/faq-articles?section=buying&visibility=visible&limit=50&offset=0
 *
 * Response:
 *   {
 *     articles: [
 *       {
 *         id: "faq_123",
 *         title: "How do I track my order?",
 *         description: "Find out the current status of your order.",
 *         section: "buying",
 *         content: "...",
 *         is_visible: true,
 *         display_order: 1,
 *         total_views: 245,
 *         created_at: "2026-03-08T10:00:00.000Z",
 *         updated_at: "2026-03-08T10:00:00.000Z"
 *       }
 *     ],
 *     count: 42,
 *     offset: 0,
 *     limit: 50
 *   }
 */

/**
 * POST /admin/faq-articles
 *
 * Create a new FAQ article
 *
 * Request Body:
 *   {
 *     title: string,                          // Required: 3-200 characters
 *     description: string,                    // Required: 10-500 characters
 *     section: string,                        // Required: buying|shipping|payments|account|community|trust
 *     content: string,                        // Required: Article content (JSON/markdown)
 *     is_visible?: boolean,                   // Optional: Default true
 *     display_order?: number                  // Optional: Default 999
 *   }
 *
 * Example Request:
 *   POST /admin/faq-articles
 *   Content-Type: application/json
 *   {
 *     "title": "How do I return an item?",
 *     "description": "Learn about our return process and policy.",
 *     "section": "buying",
 *     "content": "...",
 *     "is_visible": true,
 *     "display_order": 2
 *   }
 *
 * Response:
 *   {
 *     article: {
 *       id: "faq_456",
 *       title: "How do I return an item?",
 *       ...
 *     }
 *   }
 */

/**
 * GET /admin/faq-articles/[id]
 *
 * Fetch a single FAQ article by ID
 *
 * Path Parameters:
 *   id  string  FAQ article ID (required)
 *
 * Example Request:
 *   GET /admin/faq-articles/faq_123
 *
 * Response:
 *   {
 *     article: {
 *       id: "faq_123",
 *       title: "How do I track my order?",
 *       ...
 *     }
 *   }
 */

/**
 * PATCH /admin/faq-articles/[id]
 *
 * Update an existing FAQ article (partial updates supported)
 *
 * Path Parameters:
 *   id  string  FAQ article ID (required)
 *
 * Request Body (all optional):
 *   {
 *     title?: string,
 *     description?: string,
 *     section?: string,
 *     content?: string,
 *     is_visible?: boolean,
 *     display_order?: number
 *   }
 *
 * Example Request (toggle visibility):
 *   PATCH /admin/faq-articles/faq_123
 *   Content-Type: application/json
 *   {
 *     "is_visible": false
 *   }
 *
 * Example Request (update display order):
 *   PATCH /admin/faq-articles/faq_123
 *   Content-Type: application/json
 *   {
 *     "display_order": 5
 *   }
 *
 * Response:
 *   {
 *     article: {
 *       id: "faq_123",
 *       ...
 *       is_visible: false,
 *       display_order: 5
 *     }
 *   }
 */

/**
 * DELETE /admin/faq-articles/[id]
 *
 * Delete a FAQ article permanently
 *
 * Path Parameters:
 *   id  string  FAQ article ID (required)
 *
 * Example Request:
 *   DELETE /admin/faq-articles/faq_123
 *
 * Response:
 *   {
 *     message: "FAQ article deleted successfully"
 *   }
 */

// ───────────────────────────────────────────────────────────────────────────
// STORE ENDPOINTS (Public - For Storefront)
// ───────────────────────────────────────────────────────────────────────────

/**
 * GET /store/faq-articles
 *
 * Public endpoint to fetch visible FAQ articles for the storefront
 * Only returns articles with is_visible=true
 * Rate limited per IP
 *
 * Query Parameters:
 *   section  string  "buying" | "shipping" | "payments" | "account" | "community" | "trust" (optional)
 *   limit    number  1-200 (default: 50)
 *   offset   number  Starting position (default: 0)
 *
 * Example Request:
 *   GET /store/faq-articles?section=payments&limit=20
 *
 * Response:
 *   {
 *     articles: [
 *       {
 *         id: "faq_123",
 *         title: "Is payment information secure?",
 *         description: "Learn about our payment security measures.",
 *         section: "payments",
 *         content: "...",
 *         is_visible: true,
 *         display_order: 1,
 *         total_views: 1200,
 *         created_at: "2026-03-01T00:00:00.000Z",
 *         updated_at: "2026-03-08T10:00:00.000Z"
 *       }
 *     ],
 *     count: 8,
 *     offset: 0,
 *     limit: 20
 *   }
 */

// ───────────────────────────────────────────────────────────────────────────
// Admin Dashboard UI Usage
// ───────────────────────────────────────────────────────────────────────────

/**
 * The admin dashboard at /app/faq-queries has two tabs:
 *
 * 1. FAQ Queries Tab
 *    - Lists customer-submitted support questions
 *    - Allows admins to answer/edit questions
 *    - Filter by: All, Pending, Answered
 *    - Uses: FAQ Queries module (/admin/faq-queries)
 *
 * 2. FAQ Articles Tab
 *    - Lists help center FAQ articles
 *    - Allows admins to create/edit/delete/hide articles
 *    - Filter by: Section, Visibility
 *    - Operations:
 *      • Create: Click "Add Article" button → Modal form
 *      • Edit: Click "Edit" button on article row → Modal form
 *      • Hide/Show: Click "Hide" or "Show" button to toggle is_visible
 *      • Delete: Click "Delete" button → Permanent deletion
 *
 * Admin Service (/src/admin/services/faq-articles.ts)
 * - Provides TypeScript methods for all API operations
 * - Used by the admin page component
 * - Can be imported and used in other admin extensions
 */

// ───────────────────────────────────────────────────────────────────────────
// Error Responses
// ───────────────────────────────────────────────────────────────────────────

/**
 * 400 Bad Request
 *   {
 *     error: "Missing required fields: title, description, section, content"
 *   }
 *
 * 404 Not Found
 *   {
 *     error: "FAQ article not found"
 *   }
 *
 * 500 Internal Server Error
 *   {
 *     error: "Failed to create FAQ article"
 *   }
 */

export {}
