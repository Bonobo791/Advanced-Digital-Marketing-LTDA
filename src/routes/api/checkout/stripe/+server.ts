import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import type { Locale } from '$lib/locale'
import { PricingError } from '$lib/server/pricing'
import { StripeError, computeUsdMonthlyQuote, createCheckoutSession } from '$lib/server/stripe'
import { isValidEmail, stripeCheckoutUrls } from '$lib/server/checkout'
import { parseJsonBody, resolveClientAddress, rateLimitOrError, upstreamErrorResponse } from '$lib/server/api-route'
import { isWebsiteBuildKind, isWebsiteBuildType, websiteBuildPriceUSD, websiteBuildTitle } from '$lib/website-builds'

// en-US (USD) checkout via Stripe Checkout. BRL flows stay on Mercado Pago
// (/api/checkout/subscription, /api/checkout/build); this endpoint serves the
// English pages and bills USD. All amounts are derived server-side from the
// catalog at the 5:1 reference rate (or the explicit USD build prices) — a
// browser-supplied amount is never accepted.
export const prerender = false
export const trailingSlash = 'ignore'

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Flow = 'subscription' | 'build'

type ValidPayload =
  | { flow: 'subscription'; email: string; serviceIds: unknown; config: unknown; idempotencyKey: string; locale: Locale }
  | { flow: 'build'; type: unknown; kind: unknown; idempotencyKey: string; locale: Locale }

type ValidationOutcome = { payload: ValidPayload } | { error: string }

function validatePayload(body: Record<string, unknown>): ValidationOutcome {
  const locale: Locale = body.locale === 'pt-BR' ? 'pt-BR' : 'en-US'
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : ''
  if (!UUID_V4_RE.test(idempotencyKey)) return { error: 'invalid_idempotency_key' }

  if (body.flow === 'build') {
    return { payload: { flow: 'build', type: body.type, kind: body.kind, idempotencyKey, locale } }
  }
  if (body.flow === 'subscription') {
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    if (!isValidEmail(email)) return { error: 'invalid_email' }
    return {
      payload: {
        flow: 'subscription',
        email,
        serviceIds: body.serviceIds,
        config: body.config,
        idempotencyKey,
        locale,
      },
    }
  }
  return { error: 'invalid_build' }
}

/** USD line items for the Stripe Checkout session. */
function subscriptionLineItems(flow: Extract<ValidPayload, { flow: 'subscription' }>) {
  const quote = computeUsdMonthlyQuote(flow.serviceIds, flow.config, flow.locale)
  return {
    externalReference: quote.externalReference,
    items: quote.items.map((item) => ({
      name: item.name,
      unitAmountUSD: item.monthlyUSD,
      quantity: 1,
      recurringMonthly: true,
    })),
  }
}

function buildLineItems(flow: Extract<ValidPayload, { flow: 'build' }>) {
  if (!isWebsiteBuildType(flow.type) || !isWebsiteBuildKind(flow.kind)) {
    throw new PricingError('invalid_build', 'Invalid build selection')
  }
  return {
    externalReference: `website-build:${flow.type}:${flow.kind}`,
    items: [
      {
        name: websiteBuildTitle(flow.locale, flow.type, flow.kind),
        unitAmountUSD: websiteBuildPriceUSD(flow.type, flow.kind),
        quantity: 1,
        recurringMonthly: false,
      },
    ],
  }
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  const parsed = await parseJsonBody(request)
  if ('response' in parsed) return parsed.response

  const validated = validatePayload(parsed.payload)
  if ('error' in validated) return json({ error: validated.error }, { status: 400 })

  const resolved = resolveClientAddress(getClientAddress, 'checkout-stripe')
  if ('response' in resolved) return resolved.response

  const rateLimited = rateLimitOrError('stripeCreate', resolved.address, 'checkout-stripe', 'Stripe checkout creation')
  if ('response' in rateLimited) return rateLimited.response

  let externalReference: string
  let lineItems: { name: string; unitAmountUSD: number; quantity: number; recurringMonthly: boolean }[]
  try {
    if (validated.payload.flow === 'subscription') {
      const { externalReference: ref, items } = subscriptionLineItems(validated.payload)
      externalReference = ref
      lineItems = items
    } else {
      const { externalReference: ref, items } = buildLineItems(validated.payload)
      externalReference = ref
      lineItems = items
    }
  } catch (error) {
    if (error instanceof PricingError) {
      return json({ error: error.code }, { status: 400 })
    }
    throw error
  }

  const { successUrl, cancelUrl } = stripeCheckoutUrls()
  try {
    const session = await createCheckoutSession({
      mode: validated.payload.flow === 'subscription' ? 'subscription' : 'payment',
      lineItems,
      externalReference,
      successUrl,
      cancelUrl,
      customerEmail: validated.payload.flow === 'subscription' ? validated.payload.email : '',
      idempotencyKey: validated.payload.idempotencyKey,
    })
    return json({ checkoutUrl: session.checkoutUrl })
  } catch (error) {
    if (error instanceof StripeError) {
      return upstreamErrorResponse(error, 'checkout-stripe', 'Stripe checkout session creation')
    }
    throw error
  }
}
