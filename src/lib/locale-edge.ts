/**
 * Server-side port of the former Netlify edge function (netlify/edge-functions/locale.ts).
 *
 * The locale decision (root → /pt-br/ redirect for pt-BR language cookie, plus
 * the geo_br suggestion flag) now runs inside SvelteKit's `handle` hook on the
 * Coolify-hosted Node server (adapter-node). Geo country is read from the
 * standard forwarding headers the CDN/reverse proxy can inject (Bunny CDN,
 * Cloudflare, generic proxies) instead of the Netlify edge geo context; when no
 * header is present the suggestion flag simply never fires (best-effort).
 */
import { decideLocaleRequest } from './locale.ts'

/** Same path set the Netlify edge function used (config.path). */
export const LOCALE_EDGE_PATHS = [
  '/',
  '/about',
  '/about/',
  '/contact',
  '/contact/',
  '/services',
  '/services/',
  '/services/*',
  '/pt-br/servicos',
  '/pt-br/servicos/',
  '/pt-br/servicos/*',
] as const

/** True when the path is one of the page paths the locale logic applies to. */
export function isLocaleEdgePath(pathname: string): boolean {
  for (const entry of LOCALE_EDGE_PATHS) {
    if (entry.endsWith('/*')) {
      const prefix = entry.slice(0, -1)
      if (pathname.startsWith(prefix)) return true
    } else if (pathname === entry) {
      return true
    }
  }
  return false
}

/** Header names, in priority order, that may carry the visitor country code. */
const GEO_HEADERS = ['bunny-country', 'x-country-code', 'cf-ipcountry', 'x-geo-country']

/** Normalized (uppercase) country code from the CDN/proxy headers, if any. */
export function geoCountryFromHeaders(headers: Headers): string | undefined {
  for (const name of GEO_HEADERS) {
    const value = headers.get(name)
    if (value && value.trim()) return value.trim().toUpperCase()
  }
  return undefined
}

export type LocaleEdgeResult =
  | { type: 'redirect'; location: string }
  | { type: 'next'; geoBr?: boolean }

/**
 * Applies the locale decision for one request. Mirrors the edge function:
 * only the configured page paths are considered, non-GET/HEAD pass through,
 * and pt-BR paths never redirect or flag.
 */
export function applyLocaleEdge(
  request: Request,
  language: string | undefined,
  country: string | undefined,
): LocaleEdgeResult {
  const url = new URL(request.url)
  if (!isLocaleEdgePath(url.pathname)) return { type: 'next' }
  return decideLocaleRequest({
    method: request.method,
    pathname: url.pathname,
    search: url.search,
    language,
    country,
  })
}
