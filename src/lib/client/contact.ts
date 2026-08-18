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
    const parsed = (await response.json().catch(() => ({}))) as { ok?: unknown; expiresInHours?: unknown; error?: unknown }
    if (!response.ok) {
      return { ok: false, errorCode: typeof parsed.error === 'string' ? parsed.error : undefined }
    }
    if (parsed.ok !== true) {
      return { ok: false }
    }
    // A 200 success must carry the server-computed expiry; inventing a
    // fallback would silently show wrong copy (AGENTS.md: no silent
    // fallbacks). Treat a malformed success as a failure, logged loudly.
    if (typeof parsed.expiresInHours !== 'number') {
      console.error('[contact] malformed success response from the contact endpoint', parsed)
      return { ok: false }
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
