import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import type { Locale } from '$lib/locale'
import {
  WEBSITE_BUILD_CHECKOUT_PAYMENT_METHODS,
  isWebsiteBuildKind,
  isWebsiteBuildType,
  websiteBuildExternalReference,
  websiteBuildPriceBRL,
  websiteBuildTitle,
  type WebsiteBuildKind,
  type WebsiteBuildType,
} from '$lib/website-builds'
import { MercadoPagoError, createCheckoutPreference } from '$lib/server/mercadoPago'
import { checkoutBackUrl } from '$lib/server/checkout'
import { checkRateLimit, rateLimitKey } from '$lib/server/rate-limit'
import { ClientAddressError, clientIpAddress } from '$lib/server/client-ip'

// API routes run as Netlify Functions; the root layout's prerender/trailingSlash
// settings must not apply to them.
export const prerender = false
export const trailingSlash = 'ignore'

// Same UUID-v4 requirement as the subscription endpoint, so the
// X-Idempotency-Key header stays in the format Mercado Pago expects.
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ValidPayload = {
  type: WebsiteBuildType
  kind: WebsiteBuildKind
  idempotencyKey: string
  locale: Locale
}

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

type ValidationOutcome = { payload: ValidPayload } | { error: string }

function validatePayload(payload: Record<string, unknown>): ValidationOutcome {
  // The UI only ever sends the two known build choices; anything else is a
  // tampered or stale client and must not reach the paid Mercado Pago API.
  if (!isWebsiteBuildType(payload.type) || !isWebsiteBuildKind(payload.kind)) {
    return { error: 'invalid_build' }
  }

  const idempotencyKey = typeof payload.idempotencyKey === 'string' ? payload.idempotencyKey.trim() : ''
  if (!UUID_V4_RE.test(idempotencyKey)) return { error: 'invalid_idempotency_key' }

  // Only the locale's title copy differs; the billed amount is always the
  // authoritative BRL price, never a client-supplied number.
  const locale: Locale = payload.locale === 'en-US' ? 'en-US' : 'pt-BR'
  return {
    payload: { type: payload.type, kind: payload.kind, idempotencyKey, locale },
  }
}

type AddressOutcome = { address: string } | { response: Response }

function resolveClientAddress(getClientAddress: () => string): AddressOutcome {
  try {
    return { address: clientIpAddress(getClientAddress) }
  } catch (error) {
    if (error instanceof ClientAddressError) {
      // Fail loudly (AGENTS.md): without a client address we cannot rate-limit,
      // and pooling unidentified clients into one bucket would 429 unrelated
      // customers. Refuse the request instead of silently accepting it.
      console.error('[checkout] cannot determine client IP for rate limiting; refusing request')
      return { response: json({ error: 'client_address_unavailable' }, { status: 503 }) }
    }
    throw error
  }
}

async function createPreferenceOrError(payload: ValidPayload): Promise<Response> {
  try {
    const created = await createCheckoutPreference({
      title: websiteBuildTitle(payload.locale, payload.type, payload.kind),
      // The browser never sends an amount: the server derives the one-time
      // BRL price from the build type + kind (trust boundary, spec §4).
      amountBRL: websiteBuildPriceBRL(payload.type, payload.kind),
      externalReference: websiteBuildExternalReference(payload.type, payload.kind),
      backUrls: {
        success: checkoutBackUrl(),
        failure: checkoutBackUrl(),
        pending: checkoutBackUrl(),
      },
      idempotencyKey: payload.idempotencyKey,
      // Hosted-checkout payment methods (credit à vista/parcelado, debit,
      // Pix, boleto) + installments policy — server-side only, never sent by
      // the browser.
      paymentMethods: WEBSITE_BUILD_CHECKOUT_PAYMENT_METHODS,
    })
    return json({ checkoutUrl: created.checkoutUrl })
  } catch (error) {
    if (error instanceof MercadoPagoError) {
      console.error(`[checkout] Mercado Pago preference creation failed: ${error.code}`)
      return json({ error: error.code }, { status: mercadoPagoStatus(error.code) })
    }
    throw error
  }
}

/**
 * POST /api/checkout/build — one-time website build purchase (Checkout Pro).
 *
 * Request:  { type, kind, idempotencyKey?, locale? }
 * Response: { checkoutUrl } — Mercado Pago hosted payment checkout.
 *
 * The browser specifies only the build selection (type + kind). Every price is
 * recomputed server-side from the authoritative BRL table in website-builds.ts;
 * a client-supplied amount is never accepted.
 */
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  const parsed = await parseJsonBody(request)
  if ('response' in parsed) return parsed.response

  const validated = validatePayload(parsed.payload)
  if ('error' in validated) return json({ error: validated.error }, { status: 400 })

  // Abuse protection: the request is validated but not yet billed — every
  // accepted request here calls the paid Mercado Pago API. Throttle per client
  // IP with the same limiter as subscription creation.
  const resolved = resolveClientAddress(getClientAddress)
  if ('response' in resolved) return resolved.response

  const rateLimit = checkRateLimit(rateLimitKey('buildCreate', resolved.address))
  if (!rateLimit.allowed) {
    console.warn('[checkout] rate limit exceeded; rejecting build preference creation')
    return json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  return createPreferenceOrError(validated.payload)
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
