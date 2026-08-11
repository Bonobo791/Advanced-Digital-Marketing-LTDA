/**
 * Shared helpers for the subscription checkout endpoint (spec §4, §8).
 * Kept out of `+server.ts` so they are importable by tests — SvelteKit
 * endpoint modules only export HTTP handlers and config keys.
 */
import { SITE_ORIGIN } from '$lib/locale'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Basic email shape validation (max length per RFC 5321).
 *
 * The 254-character length guard below is load-bearing: it MUST stay in front
 * of `EMAIL_RE.test`, bounding the regex's worst-case backtracking on long
 * inputs. Do not reorder or drop it.
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
 * Back URL for the hosted checkout. The production hostname is never
 * hard-coded: it comes from PUBLIC_SITE_URL, falling back to the site's
 * canonical origin constant. The fallback is loud (logged on the server).
 *
 * A malformed, non-HTTPS, or loopback PUBLIC_SITE_URL must never crash
 * checkout or reach Mercado Pago — Mercado Pago requires a public HTTPS
 * back_url, so any such value activates the canonical-origin fallback
 * instead. The configured value is never echoed in logs — only the variable
 * name is.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])

/** A host Mercado Pago will accept as a back_url origin — public, non-loopback. */
function isPublicHostname(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return (
    host.length > 0 &&
    !LOOPBACK_HOSTS.has(host) &&
    !host.endsWith('.localhost') &&
    !host.endsWith('.local')
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
