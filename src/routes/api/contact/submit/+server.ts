import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import type { Locale } from '$lib/locale'
import { isValidEmail } from '$lib/server/checkout'
import { handleApiPost, upstreamErrorResponse } from '$lib/server/api-route'
import { submitContactRequest } from '$lib/server/contact'
import { CONTACT_TOKEN_SUBJECT_MAX_LENGTH, ContactTokenError } from '$lib/server/contact-token'
import { MailjetError } from '$lib/server/mailjet'
import { containsControlCharacter } from '$lib/server/text'

// API routes run on the Node server (adapter-node); the root layout's prerender/trailingSlash
// settings must not apply to them.
export const prerender = false
export const trailingSlash = 'ignore'

const NAME_MAX_LENGTH = 100

function isValidName(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed.length >= 1 && trimmed.length <= NAME_MAX_LENGTH && !containsControlCharacter(trimmed)
}

/**
 * Optional subject carried from the originating CTA (service option). Capped
 * and control-character-free like the name — it reaches email copy and the
 * owner notification.
 */
function isValidSubject(value: string): boolean {
  return value.length <= CONTACT_TOKEN_SUBJECT_MAX_LENGTH && !containsControlCharacter(value)
}

/** Only the two shipped locales are accepted — never a silent default (AGENTS.md). */
function isValidLocale(value: unknown): value is Locale {
  return value === 'en-US' || value === 'pt-BR'
}

/** Fields extracted from the request body after validation. */
interface ValidPayload {
  name: string
  email: string
  locale: Locale
  subject?: string
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

  if (!isValidLocale(payload.locale)) return { error: 'invalid_locale' }
  const locale = payload.locale

  const subject = typeof payload.subject === 'string' ? payload.subject.trim() : ''
  if (subject && !isValidSubject(subject)) return { error: 'invalid_subject' }

  return { payload: { name, email, locale, ...(subject ? { subject } : {}) } }
}

async function submitOrError(payload: ValidPayload): Promise<Response> {
  try {
    const result = await submitContactRequest(payload)
    return json({ ok: true, expiresInHours: result.expiresInHours })
  } catch (error) {
    if (error instanceof MailjetError) {
      return upstreamErrorResponse(error, 'contact', 'MailJet send')
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
 * Request:  { name, email, consent: true, locale, subject? }
 * Response: { ok: true, expiresInHours } — the verification email is sent;
 * the client then tells the visitor to check their inbox. A token is never
 * returned to the browser; the verification link only goes out by email.
 *
 * Every accepted request here calls the paid MailJet API, so abuse is
 * throttled per client IP before any email is sent.
 */
export const POST: RequestHandler = ({ request, getClientAddress }) =>
  handleApiPost({
    request,
    getClientAddress,
    logTag: 'contact',
    bucket: 'contactSubmit',
    rejectedWhat: 'contact submission',
    validate: validatePayload,
    run: submitOrError,
  })
