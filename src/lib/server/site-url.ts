/**
 * Public-site-origin resolution shared by every flow that must link back to
 * the deployed site (Mercado Pago back_urls, contact-form verification links).
 *
 * The production hostname is never hard-coded: it comes from PUBLIC_SITE_URL,
 * falling back to the site's canonical origin constant. The fallback is loud
 * (logged on the server).
 *
 * A malformed, non-HTTPS, loopback, or otherwise non-public PUBLIC_SITE_URL
 * (including IP literals such as 192.168.x) must never reach a third-party
 * API or an email recipient — any such value activates the canonical-origin
 * fallback instead. The configured value is never echoed in logs — only the
 * variable name is.
 */
import { SITE_ORIGIN } from '$lib/locale'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])

// IP literals (IPv4 dotted-quad, any IPv6 form) are never public HTTPS
// *domains* — a literal would be unreachable or a private RFC1918/link-local/
// ULA address.
const IPV4_LITERAL_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/

function isIpLiteral(hostname: string): boolean {
  return IPV4_LITERAL_RE.test(hostname) || hostname.includes(':')
}

/** A host that is a real public HTTPS origin — non-loopback, non-literal. */
function isPublicHostname(hostname: string): boolean {
  // A fully qualified hostname may carry a terminal dot ("localhost.",
  // "foo.local."); the URL parser preserves it, so normalize it away before
  // the loopback/suffix checks — otherwise a loopback origin would silently
  // pass validation and produce unusable verification links/callbacks.
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return (
    host.length > 0 &&
    !LOOPBACK_HOSTS.has(host) &&
    !host.endsWith('.localhost') &&
    !host.endsWith('.local') &&
    // RFC1918/link-local/ULA literals (192.168.x, 10.x, 172.16-31.x,
    // 169.254.x, fc00::/7, …) are all caught by rejecting IP literals.
    !isIpLiteral(host)
  )
}

/**
 * Returns the public HTTPS origin (scheme + host, no trailing slash) that
 * back-links to this site must use: PUBLIC_SITE_URL when it is a public HTTPS
 * URL, otherwise the canonical `SITE_ORIGIN` constant — with a loud server log
 * whenever the configured value is missing, malformed, or not public HTTPS.
 *
 * A fully qualified hostname keeps its terminal dot in `URL.origin`
 * ("https://example.com."); the returned origin drops it so back-links are
 * canonical.
 */
function normalizedOrigin(url: URL): string {
  const hostname = url.hostname.toLowerCase()
  if (!hostname.endsWith('.')) return url.origin
  const host = hostname.slice(0, -1)
  return `${url.protocol}//${host}${url.port ? `:${url.port}` : ''}`
}

export function publicSiteOrigin(): string {
  const siteUrl = process.env.PUBLIC_SITE_URL?.trim()
  if (siteUrl) {
    try {
      const url = new URL(siteUrl)
      if (url.protocol !== 'https:' || !isPublicHostname(url.hostname)) {
        console.error('[site-url] PUBLIC_SITE_URL is not a public HTTPS URL; using the SITE_ORIGIN constant')
        return SITE_ORIGIN
      }
      return normalizedOrigin(url)
    } catch {
      console.error('[site-url] PUBLIC_SITE_URL is malformed; using the SITE_ORIGIN constant')
      return SITE_ORIGIN
    }
  }
  console.error('[site-url] PUBLIC_SITE_URL is not set; using the SITE_ORIGIN constant')
  return SITE_ORIGIN
}
