import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import type { Locale } from '$lib/locale'
import { PricingError, computeMonthlyQuote } from '$lib/server/pricing'
import { MercadoPagoError, createSubscription } from '$lib/server/mercadoPago'
import { checkoutBackUrl, isValidEmail } from '$lib/server/checkout'

// API routes run as Netlify Functions; the root layout's prerender/trailingSlash
// settings must not apply to them.
export const prerender = false
export const trailingSlash = 'ignore'

/**
 * POST /api/checkout/subscription (spec §4, §8)
 *
 * Request:  { email, serviceIds, config?, idempotencyKey?, locale? }
 * Response: { checkoutUrl }  — Mercado Pago hosted subscription checkout.
 *
 * The browser specifies selections only. Every price is recomputed server-side
 * from the catalog; a client-supplied total is never accepted.
 */
export const POST: RequestHandler = async ({ request }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null) {
    return json({ error: 'invalid_json' }, { status: 400 })
  }
  const payload = body as Record<string, unknown>

  const email = typeof payload.email === 'string' ? payload.email.trim() : ''
  if (!isValidEmail(email)) {
    return json({ error: 'invalid_email' }, { status: 400 })
  }

  const idempotencyKey = typeof payload.idempotencyKey === 'string' ? payload.idempotencyKey.trim() : ''
  if (!idempotencyKey || idempotencyKey.length > 128) {
    return json({ error: 'invalid_idempotency_key' }, { status: 400 })
  }

  if (Array.isArray(payload.serviceIds) && payload.serviceIds.length > 32) {
    return json({ error: 'invalid_service' }, { status: 400 })
  }

  // Checkout exists on pt-BR pages; anything else falls back to pt-BR copy.
  const locale: Locale = payload.locale === 'en-US' ? 'en-US' : 'pt-BR'

  let quote
  try {
    quote = computeMonthlyQuote(payload.serviceIds, payload.config, locale)
  } catch (error) {
    if (error instanceof PricingError) {
      return json({ error: error.code }, { status: 400 })
    }
    throw error
  }

  try {
    const created = await createSubscription({
      email,
      reason: quote.reason,
      externalReference: quote.externalReference,
      amountBRL: quote.totalBRL,
      backUrl: checkoutBackUrl(),
      idempotencyKey,
    })
    return json({ checkoutUrl: created.checkoutUrl })
  } catch (error) {
    if (error instanceof MercadoPagoError) {
      console.error(`[checkout] Mercado Pago subscription creation failed: ${error.code}`)
      return json({ error: error.code }, { status: mercadoPagoStatus(error.code) })
    }
    throw error
  }
}

function mercadoPagoStatus(code: MercadoPagoError['code']): number {
  switch (code) {
    case 'missing_credentials':
    case 'timeout':
      return 503
    case 'unauthorized':
    case 'api_error':
    case 'invalid_response':
    case 'missing_init_point':
    case 'invalid_init_point':
      return 502
  }
}
