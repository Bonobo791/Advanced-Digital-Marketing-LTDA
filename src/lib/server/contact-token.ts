/**
 * Stateless verification tokens for the opt-in contact form.
 *
 * Double opt-in needs a link the visitor can click from their inbox; the link
 * carries a token that proves the submission was real and recent. This repo
 * has no local database (Mercado Pago / MailJet are the systems of record),
 * so the token is self-contained: a versioned JSON payload (email, name,
 * locale, issued-at, expiry) signed with an HMAC-SHA256 over the exact
 * encoded payload bytes, using a server-only secret from the environment.
 *
 * Security properties:
 *  - Unforgeable: the signature is keyed by `CONTACT_FORM_TOKEN_SECRET`, which
 *    never leaves the server. Verification recomputes the MAC and compares
 *    with a timing-safe comparison.
 *  - Expiring: `CONTACT_TOKEN_TTL_SECONDS` (72h) bounds how long a link stays
 *    valid, so a leaked link cannot be used forever.
 *  - Tamper-evident: any edit to the payload breaks the MAC, and the version
 *    field lets the format evolve without silently accepting old shapes.
 *
 * The secret is read from the environment at call time (injectable for
 * tests). A missing secret fails loudly with a typed error — never a silent
 * fallback (AGENTS.md).
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Locale } from '$lib/locale'

export const CONTACT_TOKEN_VERSION = 1
export const CONTACT_TOKEN_TTL_SECONDS = 72 * 60 * 60

/** Token-format failure modes. */
export type ContactTokenErrorCode = 'missing_secret' | 'malformed_token'

export class ContactTokenError extends Error {
  code: ContactTokenErrorCode

  constructor(code: ContactTokenErrorCode, message: string) {
    super(message)
    this.name = 'ContactTokenError'
    this.code = code
  }
}

/** Data embedded in a signed token. */
export type ContactTokenPayload = {
  email: string
  name: string
  locale: Locale
  issuedAt: number
  expiresAt: number
}

export type ContactTokenResult =
  | { status: 'verified'; payload: ContactTokenPayload }
  | { status: 'expired' }
  | { status: 'invalid' }

/** Server-only signing secret; undefined means the form is not configured. */
export function readContactTokenSecret(): string | undefined {
  const secret = process.env.CONTACT_FORM_TOKEN_SECRET?.trim()
  return secret || undefined
}

/** base64url (RFC 4648 §5) without padding — URL- and email-safe. */
function base64urlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function base64urlDecode(value: string): string | undefined {
  // Reject anything base64url cannot express (whitespace, '+', '/', padding).
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return undefined
  try {
    return Buffer.from(value, 'base64url').toString('utf8')
  } catch {
    return undefined
  }
}

function sign(secret: string, encodedPayload: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('hex')
}

// Full-length, even-length hex only: Buffer.from(value, 'hex') silently stops
// at the first invalid character, so a valid signature with junk appended
// would otherwise compare equal. Rejecting non-canonical signatures keeps the
// token format strict (one token string per payload+MAC).
const HEX_SIGNATURE_RE = /^(?:[0-9a-f]{2})+$/

function safeEqualHex(a: string, b: string): boolean {
  if (!HEX_SIGNATURE_RE.test(a) || !HEX_SIGNATURE_RE.test(b)) return false
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
}

function isLocale(value: unknown): value is Locale {
  return value === 'en-US' || value === 'pt-BR'
}

function isEpochSeconds(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

function parsePayload(value: string): ContactTokenPayload | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return undefined
  }
  if (!Array.isArray(parsed) || parsed.length !== 6) return undefined
  const [version, email, name, locale, issuedAt, expiresAt] = parsed
  if (version !== CONTACT_TOKEN_VERSION) return undefined
  if (!isNonEmptyString(email, 254)) return undefined
  if (!isNonEmptyString(name, 100)) return undefined
  if (!isLocale(locale)) return undefined
  if (!isEpochSeconds(issuedAt) || !isEpochSeconds(expiresAt) || expiresAt <= issuedAt) return undefined
  return { email, name, locale, issuedAt, expiresAt }
}

export type ContactTokenInput = {
  email: string
  name: string
  locale: Locale
}

/**
 * Signs a new verification token. Throws `ContactTokenError('missing_secret')`
 * when `CONTACT_FORM_TOKEN_SECRET` is not configured — a loud refusal, never a
 * silent unsigned token. `now` and `secret` are injectable for tests.
 */
export function createContactToken(
  input: ContactTokenInput,
  now: number = Date.now(),
  secret: string | undefined = readContactTokenSecret(),
): { token: string; expiresAt: number } {
  if (!secret) {
    throw new ContactTokenError('missing_secret', 'CONTACT_FORM_TOKEN_SECRET is not configured')
  }
  const issuedAt = Math.floor(now / 1000)
  const expiresAt = issuedAt + CONTACT_TOKEN_TTL_SECONDS
  const encoded = base64urlEncode(
    JSON.stringify([CONTACT_TOKEN_VERSION, input.email, input.name, input.locale, issuedAt, expiresAt]),
  )
  return { token: `${encoded}.${sign(secret, encoded)}`, expiresAt: expiresAt * 1000 }
}

/**
 * Verifies a token: format, signature (timing-safe), version, and expiry.
 * A token signed with a missing secret is treated as invalid (the server is
 * misconfigured, so nothing can be trusted) and logged loudly.
 * `now` is injectable for tests.
 */
export function verifyContactToken(token: string, now: number = Date.now()): ContactTokenResult {
  const secret = readContactTokenSecret()
  if (!secret) {
    console.error('[contact-token] CONTACT_FORM_TOKEN_SECRET is not configured; refusing to verify tokens')
    return { status: 'invalid' }
  }

  const dot = token.indexOf('.')
  if (dot <= 0 || dot === token.length - 1 || token.includes('.', dot + 1)) {
    return { status: 'invalid' }
  }
  const encoded = token.slice(0, dot)
  const signature = token.slice(dot + 1)

  if (!safeEqualHex(sign(secret, encoded), signature)) return { status: 'invalid' }

  const decoded = base64urlDecode(encoded)
  if (decoded === undefined) return { status: 'invalid' }
  const payload = parsePayload(decoded)
  if (!payload) return { status: 'invalid' }

  if (payload.expiresAt <= Math.floor(now / 1000)) return { status: 'expired' }
  return { status: 'verified', payload }
}
