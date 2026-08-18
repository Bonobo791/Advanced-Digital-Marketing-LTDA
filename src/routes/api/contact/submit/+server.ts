import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import type { Locale } from '$lib/locale'
import { isValidEmail } from '$lib/server/checkout'
import { ClientAddressError, clientIpAddress } from '$lib/server/client-ip'
import { submitContactRequest } from '$lib/server/contact'
import { ContactTokenError } from '$lib/server/contact-token'
import { MailjetError } from '$lib/server/mailjet'
import { checkRateLimit, rateLimitKey } from '$lib/server/rate-limit'

// API routes run as Netlify Functions; the root layout's prerender/trailingSlash
// settings must not apply to them.
export const prerender = false
export const trailingSlash = 'ignore'

const NAME_MAX_LENGTH = 100

// Name is echoed into email copy and the owner notification, so control
// characters are rejected up front (log-forging / terminal escape injection).
const CONTROL_CHAR_RE = /[\u0000-\u001f\u007f]/

function isValidName(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed.length >= 1 && trimmed.length <= NAME_MAX_LENGTH && !CONTROL_CHAR_RE.test(trimmed)
}

/** Fields extracted from the request body after validation. */
type ValidPayload = {
  name: string
  email: string
  locale: Locale
}

/** JSON parse outcome: the raw payload, or the 400 response to return. */
type ParseOutcome = { payload: Record<string, unknown> } | { response: Response }

async function parseJsonBody(request: Request): Promise<ParseOutcome> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return { response: json({ error: 'invalid_json' }, { status: 400 }) }
  }
  if (typeof body !== 'object' || body === null) {
    return { response: json({ error: 'invalid_json' }, { status: 400 }) }
  }
  return { payload: body as Record<string, unknown> }
}

/** Validation outcome: the typed payload, or the error code to return. */
type ValidationOutcome = { payload: ValidPayload } | { error: string }

function validatePayload(payload: Record<string, unknown>): ValidationOutcome {
  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  if (!isValidName(name)) return { error: 'invalid_name' }

  const email = typeof payload.email === 'string' ? payload.email.trim() : ''
  if (!isValidEmail(email)) return { error: 'invalid_email' }

  // Explicit opt-in: the checkbox must be exactly `true`. Anything else —
  // missing, "yes", "1" — is rejected, because the consent box is the legal
  // basis for the contact and must be a deliberate boolean choice.
  if (payload.consent !== true) return { error: 'consent_required' }

  const locale: Locale = payload.locale === 'pt-BR' ? 'pt-BR' : 'en-US'
  return { payload: { name, email, locale } }
}

/** IP resolution outcome: the client address, or the 503 response to return. */
type AddressOutcome = { address: string } | { response: Response }

function resolveClientAddress(getClientAddress: () => string): AddressOutcome {
  try {
    return { address: clientIpAddress(getClientAddress) }
  } catch (error) {
    if (error instanceof ClientAddressError) {
      // Fail loudly (AGENTS.md): without a client address we cannot rate-limit.
      console.error('[contact] cannot determine client IP for rate limiting; refusing request')
      return { response: json({ error: 'client_address_unavailable' }, { status: 503 }) }
    }
    throw error
  }
}

/** Maps upstream failures to stable status codes; never leaks internals. */
function mailjetStatus(code: MailjetError['code']): number {
  switch (code) {
    case 'missing_credentials':
    case 'timeout':
      return 503
    case 'unauthorized':
    case 'sender_not_authorized':
    case 'message_rejected':
    case 'api_error':
    case 'invalid_response':
      return 502
    default:
      return 502
  }
}

async function submitOrError(payload: ValidPayload): Promise<Response> {
  try {
    const result = await submitContactRequest(payload)
    return json({ ok: true, expiresInHours: result.expiresInHours })
  } catch (error) {
    if (error instanceof MailjetError) {
      console.error(`[contact] MailJet send failed: ${error.code}`)
      return json({ error: error.code }, { status: mailjetStatus(error.code) })
    }
    if (error instanceof ContactTokenError) {
      console.error(`[contact] token signing failed: ${error.code}`)
      return json({ error: 'server_misconfigured' }, { status: 503 })
    }
    throw error
  }
}

/**
 * POST /api/contact/submit
 *
 * Request:  { name, email, consent: true, locale? }
 * Response: { ok: true, expiresInHours } — the verification email is sent;
 * the client then tells the visitor to check their inbox. A token is never
 * returned to the browser; the verification link only goes out by email.
 *
 * Every accepted request here calls the paid MailJet API, so abuse is
 * throttled per client IP before any email is sent.
 */
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  const parsed = await parseJsonBody(request)
  if ('response' in parsed) return parsed.response

  const validated = validatePayload(parsed.payload)
  if ('error' in validated) return json({ error: validated.error }, { status: 400 })

  const resolved = resolveClientAddress(getClientAddress)
  if ('response' in resolved) return resolved.response

  const rateLimit = checkRateLimit(rateLimitKey('contactSubmit', resolved.address))
  if (!rateLimit.allowed) {
    console.warn('[contact] rate limit exceeded; rejecting contact submission')
    return json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  return submitOrError(validated.payload)
}
