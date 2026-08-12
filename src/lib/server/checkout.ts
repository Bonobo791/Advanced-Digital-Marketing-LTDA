/**
 * Shared helpers for the subscription checkout endpoint (spec §4, §8).
 * Kept out of `+server.ts` so they are importable by tests — SvelteKit
 * endpoint modules only export HTTP handlers and config keys.
 */
import { SITE_ORIGIN } from '$lib/locale'

// Linear-time shape: the local and domain-run classes cannot match the literal
// separators ('@' and '.'), so each separator has exactly one match position
// and the engine never backtracks over overlapping repetitions.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/

/**
 * Basic email shape validation (max length per RFC 5321).
 *
 * The 254-character length guard below MUST stay in front of `EMAIL_RE.test`,
 * enforcing the RFC 5321 maximum address length (the regex itself is linear,
 * so it needs no bounding for backtracking).
 */
export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value)
}

/**
 * Mercado Pago preapproval IDs are opaque server-generated identifiers
 * (hex-shaped in the observed responses, e.g. "2c938084…"), so this guard is
 * deliberately conservative: it only rejects the obvious junk a scripted flood
 * would send (special characters, control bytes, absurd length) while any
 * real identifier passes. `getSubscription` URL-encodes the id; this check
 * keeps malformed values from ever reaching the paid API at all.
 */
const PREAPPROVAL_ID_RE = /^[A-Za-z0-9_-]{1,128}$/

export function isValidPreapprovalId(value: string): boolean {
  return PREAPPROVAL_ID_RE.test(value)
}

/**
 * Mercado Pago payment ids (Checkout Pro) are decimal strings of varying
 * length; the same conservative shape guard as preapproval ids applies.
 */
const PAYMENT_ID_RE = /^[A-Za-z0-9_-]{1,128}$/

export function isValidPaymentId(value: string): boolean {
  return PAYMENT_ID_RE.test(value)
}

/**
 * Back URL for the hosted checkout. The production hostname is never
 * hard-coded: it comes from PUBLIC_SITE_URL, falling back to the site's
 * canonical origin constant. The fallback is loud (logged on the server).
 *
 * A malformed, non-HTTPS, loopback, or otherwise non-public PUBLIC_SITE_URL
 * (including IP literals such as 192.168.x) must never crash checkout or
 * reach Mercado Pago — Mercado Pago requires a public HTTPS back_url, so any
 * such value activates the canonical-origin fallback instead. The configured
 * value is never echoed in logs — only the variable name is.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])

// IP literals (IPv4 dotted-quad, any IPv6 form) are never public HTTPS
// *domains* — Mercado Pago requires a public domain as back_url, and a
// literal would be unreachable or a private RFC1918/link-local/ULA address.
const IPV4_LITERAL_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/

function isIpLiteral(hostname: string): boolean {
  return IPV4_LITERAL_RE.test(hostname) || hostname.includes(':')
}

/** A host Mercado Pago will accept as a back_url origin — public, non-loopback. */
function isPublicHostname(hostname: string): boolean {
  const host = hostname.toLowerCase()
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

export function checkoutBackUrl(): string {
  const siteUrl = process.env.PUBLIC_SITE_URL?.trim()
  if (siteUrl) {
    try {
      const url = new URL(siteUrl)
      if (url.protocol !== 'https:' || !isPublicHostname(url.hostname)) {
        console.error('[checkout] PUBLIC_SITE_URL is not a public HTTPS URL; using the SITE_ORIGIN constant for the Mercado Pago back_url')
        return new URL('/pt-br/checkout/complete/', SITE_ORIGIN).toString()
      }
      return new URL('/pt-br/checkout/complete/', url).toString()
    } catch {
      console.error('[checkout] PUBLIC_SITE_URL is malformed; using the SITE_ORIGIN constant for the Mercado Pago back_url')
      return new URL('/pt-br/checkout/complete/', SITE_ORIGIN).toString()
    }
  }
  console.error(
    '[checkout] PUBLIC_SITE_URL is not set; using the SITE_ORIGIN constant for the Mercado Pago back_url',
  )
  return new URL('/pt-br/checkout/complete/', SITE_ORIGIN).toString()
}
