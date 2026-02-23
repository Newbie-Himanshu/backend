/// <reference types="vite/client" />

// Global variables injected by Medusa's Vite build for admin extensions.
// Corresponds to values set in medusa-config.ts (admin.path / admin.backendUrl / admin.storefrontUrl).
declare const __BASE__: string
declare const __BACKEND_URL__: string
declare const __STOREFRONT_URL__: string
