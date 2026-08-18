/**
 * Shared helpers for the subscription checkout endpoint (spec §4, §8).
 * Kept out of `+server.ts` so they are importable by tests — SvelteKit
 * endpoint modules only export HTTP handlers and config keys.
 */

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
 * Back URL for the hosted checkout. The production hostname resolution is
 * shared with the contact form (`publicSiteOrigin()` in site-url.ts) and is
 * loud when it falls back to the canonical origin — see site-url.ts.
 */
import { publicSiteOrigin } from './site-url.ts'

export function checkoutBackUrl(): string {
  return new URL('/pt-br/checkout/complete/', publicSiteOrigin()).toString()
}
