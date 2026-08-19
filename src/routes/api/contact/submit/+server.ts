import { json, redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import type { Locale } from '$lib/locale'
import { isValidEmail } from '$lib/server/checkout'
import { parseJsonBody, resolveClientAddress, rateLimitOrError, upstreamErrorResponse, type ParseOutcome } from '$lib/server/api-route'
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

/**
 * Parses the request body as JSON (the JS flow) or urlencoded (the native
 * no-JavaScript form POST: method=post + action=/api/contact/submit). The
 * consent checkbox only appears in urlencoded bodies when checked, so a
 * native submission maps checked → true, absent → not consented — the same
 * deliberate boolean requirement as the JSON flow.
 */
async function parseContactBody(request: Request): Promise<ParseOutcome> {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return { response: json({ error: 'invalid_json' }, { status: 400 }) }
    }
    const payload: Record<string, unknown> = {
      name: typeof form.get('name') === 'string' ? String(form.get('name')) : '',
      email: typeof form.get('email') === 'string' ? String(form.get('email')) : '',
      consent: form.get('consent') !== null,
      locale: typeof form.get('locale') === 'string' ? String(form.get('locale')) : '',
    }
    const subject = form.get('subject')
    if (typeof subject === 'string' && subject.trim()) payload.subject = subject
    return { payload }
  }
  return parseJsonBody(request)
}

/** Contact page for each locale — the target of native (no-JS) form redirects. */
const CONTACT_ROUTES: Record<Locale, string> = {
  'en-US': '/contact/',
  'pt-BR': '/pt-br/contato/',
}

async function submitOrError(payload: ValidPayload, native: boolean): Promise<Response> {
  try {
    const result = await submitContactRequest(payload)
    if (native) {
      // A no-JavaScript submission is a full-page flow: send the browser back
      // to the contact page with a success marker (never raw JSON).
      throw redirect(303, `${CONTACT_ROUTES[payload.locale]}?sent=1`)
    }
    return json({ ok: true, expiresInHours: result.expiresInHours })
  } catch (error) {
    if (native && (error instanceof MailjetError || error instanceof ContactTokenError)) {
      const code = error instanceof MailjetError ? error.code : 'server_misconfigured'
      console.error(`[contact] MailJet send failed: ${code}`)
      throw redirect(303, `${CONTACT_ROUTES[payload.locale]}?error=${code}`)
    }
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
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  // Native (no-JS) form posts are urlencoded and expect a browser flow (303
  // redirect to the contact page); JavaScript requests get JSON as before.
  const native = (request.headers.get('content-type') ?? '').includes('application/x-www-form-urlencoded')

  const parsed = await parseContactBody(request)
  if ('response' in parsed) {
    if (native) throw redirect(303, `${CONTACT_ROUTES['en-US']}?error=invalid_json`)
    return parsed.response
  }

  const validated = validatePayload(parsed.payload)
  if ('error' in validated) {
    if (native) {
      const locale = parsed.payload.locale === 'pt-BR' ? 'pt-BR' : 'en-US'
      throw redirect(303, `${CONTACT_ROUTES[locale]}?error=${validated.error}`)
    }
    return json({ error: validated.error }, { status: 400 })
  }

  const resolved = resolveClientAddress(getClientAddress, 'contact')
  if ('response' in resolved) {
    if (native) throw redirect(303, `${CONTACT_ROUTES[validated.payload.locale]}?error=client_address_unavailable`)
    return resolved.response
  }

  const rateLimited = rateLimitOrError('contactSubmit', resolved.address, 'contact', 'contact submission')
  if ('response' in rateLimited) {
    if (native) throw redirect(303, `${CONTACT_ROUTES[validated.payload.locale]}?error=rate_limited`)
    return rateLimited.response
  }

  return submitOrError(validated.payload, native)
}
