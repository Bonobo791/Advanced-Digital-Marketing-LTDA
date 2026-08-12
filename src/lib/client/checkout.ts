/**
 * Shared browser-side checkout fetch.
 *
 * POSTs the checkout payload to one of the `/api/checkout/*` endpoints with a
 * bounded abort timer. The timer is deliberately LONGER than the server's
 * Mercado Pago request timeout (`REQUEST_TIMEOUT_MS`): the browser clock
 * starts when the fetch is issued and therefore also covers browser→function
 * latency and server processing, so an equal or shorter client timeout could
 * abort right as the server returns the checkout URL (guarded by
 * `checkout-timeouts.unit.test.ts` via `CHECKOUT_REQUEST_TIMEOUT_MS`).
 *
 * Returns the server's checkout URL, or the machine-readable error code from
 * the response body (undefined when the body carries no code). Failures are
 * logged loudly client-side; each caller maps codes to its own user copy.
 */
import { CHECKOUT_REQUEST_TIMEOUT_MS } from '$lib/constants'

export type CheckoutFetchResult = { ok: true; checkoutUrl: string } | { ok: false; errorCode?: string }

export async function fetchCheckoutUrl(endpoint: string, body: unknown): Promise<CheckoutFetchResult> {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), CHECKOUT_REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const parsed = (await response.json().catch(() => ({}))) as { checkoutUrl?: unknown; error?: unknown }
    if (!response.ok) {
      return { ok: false, errorCode: typeof parsed.error === 'string' ? parsed.error : undefined }
    }
    if (typeof parsed.checkoutUrl !== 'string') {
      return { ok: false }
    }
    return { ok: true, checkoutUrl: parsed.checkoutUrl }
  } catch (error) {
    // Fail loudly on the client log; keep the generic message user-facing.
    console.error(`[checkout] request to ${endpoint} failed`, error)
    return { ok: false }
  } finally {
    globalThis.clearTimeout(timeout)
  }
}
