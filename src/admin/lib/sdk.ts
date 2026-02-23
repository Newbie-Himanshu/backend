import Medusa from "@medusajs/js-sdk"

/**
 * Singleton Medusa JS SDK instance for all admin UI customizations.
 *
 * Uses session-based auth (cookie) — the same session maintained by the
 * Medusa Admin dashboard — so all requests are automatically authenticated
 * without needing to pass tokens manually.
 *
 * Usage (with TanStack Query):
 *   import { sdk } from "../lib/sdk"
 *   import { useQuery } from "@tanstack/react-query"
 *
 *   const { data, isLoading } = useQuery({
 *     queryKey: ["my-resource"],
 *     queryFn: () => sdk.client.fetch("/admin/custom/my-route"),
 *   })
 */
export const sdk = new Medusa({
    baseUrl: import.meta.env.VITE_BACKEND_URL || "/",
    debug:   import.meta.env.DEV,
    auth: {
        type: "session",
    },
})
