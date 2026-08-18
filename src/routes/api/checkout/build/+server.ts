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
import { handleApiPost, upstreamErrorResponse } from '$lib/server/api-route'

// API routes run as Netlify Functions; the root layout's prerender/trailingSlash
// settings must not apply to them.
export const prerender = false
export const trailingSlash = 'ignore'

// Same UUID-v4 requirement as the subscription endpoint, so the
// X-Idempotency-Key header stays in the format Mercado Pago expects.
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface ValidPayload {
  type: WebsiteBuildType
  kind: WebsiteBuildKind
  idempotencyKey: string
  locale: Locale
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
      return upstreamErrorResponse(error, 'checkout', 'Mercado Pago preference creation')
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
export const POST: RequestHandler = ({ request, getClientAddress }) =>
  handleApiPost({
    request,
    getClientAddress,
    logTag: 'checkout',
    bucket: 'buildCreate',
    rejectedWhat: 'build preference creation',
    validate: validatePayload,
    run: createPreferenceOrError,
  })
