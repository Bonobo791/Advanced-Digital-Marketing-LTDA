// Server-rendered (SSR) — see docs/coolify-deployment.md. adapter-node serves
// prerendered files straight from disk, bypassing the `handle` hook, which
// would silently kill the locale redirect and geo cookie logic in
// src/hooks.server.ts. Bunny CDN provides the edge caching instead.
export const prerender = false
export const trailingSlash = 'always'
