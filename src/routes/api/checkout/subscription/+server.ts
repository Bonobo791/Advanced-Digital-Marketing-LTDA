import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import type { Locale } from '$lib/locale'
import { PricingError, computeMonthlyQuote } from '$lib/server/pricing'
import { MercadoPagoError, createSubscription } from '$lib/server/mercadoPago'
import { checkoutBackUrl, isValidEmail } from '$lib/server/checkout'
import { checkRateLimit, rateLimitKey } from '$lib/server/rate-limit'
import { ClientAddressError, clientIpAddress } from '$lib/server/client-ip'

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
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
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

  // The client always sends a fresh UUID v4 (crypto.randomUUID); rejecting
  // anything else keeps the X-Idempotency-Key header in the format Mercado
  // Pago expects and documented in docs/mercado-pago-subscriptions.md.
  const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const idempotencyKey = typeof payload.idempotencyKey === 'string' ? payload.idempotencyKey.trim() : ''
  if (!UUID_V4_RE.test(idempotencyKey)) {
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

  // Abuse protection: the request is validated but not yet billed — every
  // accepted request here calls the paid Mercado Pago API. Throttle per client
  // IP (best-effort per serverless instance; see rate-limit.ts).
  let clientAddress: string
  try {
    clientAddress = clientIpAddress(getClientAddress)
  } catch (error) {
    if (error instanceof ClientAddressError) {
      // Fail loudly (AGENTS.md): without a client address we cannot rate-limit,
      // and pooling unidentified clients into one bucket would 429 unrelated
      // customers. Refuse the request instead of silently accepting it.
      console.error('[checkout] cannot determine client IP for rate limiting; refusing request')
      return json({ error: 'client_address_unavailable' }, { status: 503 })
    }
    throw error
  }
  const rateLimit = checkRateLimit(rateLimitKey('subscriptionCreate', clientAddress))
  if (!rateLimit.allowed) {
    console.warn('[checkout] rate limit exceeded; rejecting subscription creation')
    return json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } })
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
    default:
      // A newly added MercadoPagoError code must still produce a valid status.
      return 502
  }
}

