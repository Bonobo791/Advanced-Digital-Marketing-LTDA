/**
 * Shared browser-side contact-form submission.
 *
 * POSTs the opt-in form payload to /api/contact/submit with a bounded abort
 * timer. The timer is deliberately LONGER than the server's MailJet request
 * timeout (`MAILJET_REQUEST_TIMEOUT_MS`): the browser clock starts when the
 * fetch is issued and therefore also covers browser→function latency and
 * server processing (guarded by the same unit test that guards the checkout
 * timers). A token is never returned to the browser — the verification link
 * only goes out by email.
 */
import { CONTACT_REQUEST_TIMEOUT_MS } from '$lib/constants'

export type ContactSubmitFetchResult = { ok: true; expiresInHours: number } | { ok: false; errorCode?: string }

/**
 * Normalizes a parsed JSON body to a non-array record, or undefined for
 * null/array/primitive bodies — property access on those would throw.
 */
function asRecord(raw: unknown): { ok?: unknown; expiresInHours?: unknown; error?: unknown } | undefined {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw)
    ? (raw as { ok?: unknown; expiresInHours?: unknown; error?: unknown })
    : undefined
}

/** True only for a server-computed positive finite expiry (the response contract). */
function isValidExpiry(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export async function submitContactForm(endpoint: string, body: unknown): Promise<ContactSubmitFetchResult> {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), CONTACT_REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const raw: unknown = await response.json().catch(() => undefined)
    const parsed = asRecord(raw)
    if (!response.ok) {
      return { ok: false, errorCode: typeof parsed?.error === 'string' ? parsed.error : undefined }
    }
    // A 200 without ok:true (or a non-object body) is a malformed success:
    // log it loudly instead of failing silently (AGENTS.md: no silent
    // fallbacks).
    if (parsed?.ok !== true) {
      console.error('[contact] malformed success response from the contact endpoint', raw)
      return { ok: false, errorCode: 'invalid_response' }
    }
    // A 200 success must carry the server-computed expiry; inventing a
    // fallback would silently show wrong copy (AGENTS.md: no silent
    // fallbacks). Treat a malformed success (null/array/primitive body, or a
    // missing/non-positive/non-finite expiry) as a failure, logged loudly.
    if (!isValidExpiry(parsed.expiresInHours)) {
      console.error('[contact] malformed success response from the contact endpoint', raw)
      return { ok: false, errorCode: 'invalid_response' }
    }
    return { ok: true, expiresInHours: parsed.expiresInHours }
  } catch (error) {
    // Fail loudly on the client log; keep the generic message user-facing.
    console.error(`[contact] request to ${endpoint} failed`, error)
    return { ok: false }
  } finally {
    globalThis.clearTimeout(timeout)
  }
}
