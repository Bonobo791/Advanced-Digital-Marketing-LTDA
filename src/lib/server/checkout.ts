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
 * Back URL for the hosted checkout. The production hostname is never
 * hard-coded: it comes from PUBLIC_SITE_URL, falling back to the site's
 * canonical origin constant. The fallback is loud (logged on the server).
 *
 * A malformed PUBLIC_SITE_URL (e.g. a value without a scheme) must never crash
 * checkout: the URL construction is wrapped so the configured value is not
 * echoed in logs — only the variable name is.
 */
export function checkoutBackUrl(): string {
  const siteUrl = process.env.PUBLIC_SITE_URL?.trim()
  if (siteUrl) {
    try {
      return new URL('/pt-br/checkout/complete/', siteUrl).toString()
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
