/**
 * src/scripts/create-meilisearch-scoped-key.ts
 *
 * One-time setup: creates a scoped Meilisearch API key for the E-Commerce Backend.
 * Fixes BUG-001 — replaces the master key with a principle-of-least-privilege key.
 *
 * USAGE
 * ─────
 * 1. Add your master key to .env temporarily:
 *      MEILISEARCH_MASTER_KEY=your-master-key-here
 *
 * 2. Run the script:
 *      yarn medusa exec ./src/scripts/create-meilisearch-scoped-key.ts
 *
 * 3. Copy the printed key into .env:
 *      MEILISEARCH_API_KEY=<printed key>
 *
 * 4. Remove MEILISEARCH_MASTER_KEY from .env — it is no longer needed at runtime.
 *
 * 5. Restart the server — the startup guard in meilisearch/service.ts will confirm
 *    the new key is properly scoped (no 403 warning will appear).
 *
 * PERMISSIONS GRANTED
 * ────────────────────
 * The created key can ONLY perform these actions on the products index:
 *   documents.add    → index products
 *   documents.get    → read back indexed products
 *   documents.delete → remove products from index
 *   indexes.search   → run search queries
 *   indexes.update   → update index settings (searchable/filterable attributes)
 *
 * It CANNOT: delete the index, create/list/delete API keys, manage instances.
 */

import { loadEnv } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV ?? "development", process.cwd())

async function main() {
  const host       = process.env.MEILISEARCH_HOST
  const masterKey  = process.env.MEILISEARCH_MASTER_KEY
  const indexName  = process.env.MEILISEARCH_PRODUCT_INDEX_NAME ?? "products"

  if (!host) {
    console.error("❌ MEILISEARCH_HOST is not set in .env")
    process.exit(1)
  }
  if (!masterKey) {
    console.error(
      "❌ MEILISEARCH_MASTER_KEY is not set in .env\n" +
      "   Add it temporarily to run this script, then remove it after."
    )
    process.exit(1)
  }

  console.log(`\n🔑  Connecting to Meilisearch at ${host}`)
  console.log(`📦  Scoping key to index: "${indexName}"\n`)

  const { Meilisearch } = await import("meilisearch")
  const client = new Meilisearch({ host, apiKey: masterKey })

  // Verify master key works before proceeding
  try {
    await client.health()
  } catch {
    console.error(`❌ Could not reach Meilisearch at ${host}. Is it running?`)
    process.exit(1)
  }

  // Create the scoped key
  const key = await client.createKey({
    name:        "backend-scoped",
    description: "Scoped server key for E-Commerce Backend: index + search products only",
    actions: [
      "documents.add",
      "documents.get",
      "documents.delete",
      "indexes.search",
      "indexes.update",
    ],
    indexes:   [indexName],
    expiresAt: null, // Non-expiring — rotate manually if compromised
  })

  console.log("✅  Scoped API key created successfully!")
  console.log("──────────────────────────────────────────────────────────────")
  console.log(`Key UID:  ${key.uid}`)
  console.log(`Key:      ${key.key}`)
  console.log("──────────────────────────────────────────────────────────────")
  console.log("\n📋  Next steps:")
  console.log(`\n  1. Update your .env file:\n       MEILISEARCH_API_KEY=${key.key}`)
  console.log("\n  2. Remove MEILISEARCH_MASTER_KEY from .env (NOT needed at runtime).")
  console.log("\n  3. Restart the Medusa server.")
  console.log("     The startup guard in meilisearch/service.ts will verify the key")
  console.log("     is correctly scoped (403 on getKeys = good).\n")
}

main().catch((err: Error) => {
  console.error("❌ Failed to create scoped key:", err.message)
  process.exit(1)
})
