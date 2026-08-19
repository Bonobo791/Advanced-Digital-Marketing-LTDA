/**
 * Stripe Checkout client for the en-US (USD) checkout flows.
 *
 * Mercado Pago bills BRL from the Brazilian account; English pages get a
 * Stripe-hosted checkout billed in USD. This module isolates all Stripe API
 * access (raw REST — no SDK dependency, matching the Mercado Pago client):
 * create a Checkout Session, retrieve one for return-page verification, and
 * verify webhook signatures. Server-only: reads `STRIPE_SECRET_KEY` and
 * `STRIPE_WEBHOOK_SECRET` from the environment.
 *
 * USD amounts are derived server-side from the catalog at the 5:1 reference
 * rate (see `BRL_USD_REFERENCE_RATE`) or from the explicit USD build prices —
 * a browser-supplied amount is never accepted.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  BRL_USD_REFERENCE_RATE,
  SERVICES,
  adSpendFeeUSD,
  type CatalogService,
  type CatalogServiceId,
} from '$lib/catalog'
import type { Locale } from '$lib/locale'
import { PricingError, buildQuote, monthlyAdSpendOf } from './pricing.ts'

export const STRIPE_API = 'https://api.stripe.com'
export const STRIPE_REQUEST_TIMEOUT_MS = 15_000

export type StripeErrorCode =
  | 'missing_credentials'
  | 'unauthorized'
  | 'api_error'
  | 'timeout'
  | 'invalid_response'
  | 'invalid_url'
  | 'not_found'

export class StripeError extends Error {
  code: StripeErrorCode

  constructor(code: StripeErrorCode, message: string) {
    super(message)
    this.name = 'StripeError'
    this.code = code
  }
}

function readCredentials(): { secretKey?: string; webhookSecret?: string } {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY?.trim() || undefined,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || undefined,
  }
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'TimeoutError') return true
  const cause = error instanceof Error ? (error as { cause?: unknown }).cause : undefined
  return cause instanceof Error && cause.name === 'TimeoutError'
}

/** Validates the hosted-checkout URL Stripe returns (HTTPS, Stripe host). */
export function isAllowedCheckoutUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  const host = url.hostname.toLowerCase()
  return host === 'checkout.stripe.com' || host.endsWith('.checkout.stripe.com')
}

export type StripeLineItem = {
  name: string
  /** One-time or monthly unit amount in USD (server-derived). */
  unitAmountUSD: number
  quantity: number
  recurringMonthly: boolean
}

export type CreateCheckoutSessionInput = {
  mode: 'subscription' | 'payment'
  lineItems: StripeLineItem[]
  externalReference: string
  successUrl: string
  cancelUrl: string
  customerEmail: string
  idempotencyKey: string
}

export type StripeSessionCreated = { id: string; checkoutUrl: string }

export type CheckoutSessionStatus = {
  id: string
  status: string | null
  paymentStatus: string | null
  customerEmail: string | null
  amountTotal: number | null
  currency: string | null
  clientReferenceId: string | null
}

/** URL-encodes one nested `line_items[i][field]` entry into the form body. */
function lineItemParams(items: StripeLineItem[]): URLSearchParams {
  const params = new URLSearchParams()
  items.forEach((item, index) => {
    const prefix = `line_items[${index}]`
    params.set(`${prefix}[quantity]`, String(item.quantity))
    params.set(`${prefix}[price_data][currency]`, 'usd')
    params.set(`${prefix}[price_data][unit_amount]`, String(Math.round(item.unitAmountUSD * 100)))
    params.set(`${prefix}[price_data][product_data][name]`, item.name)
    if (item.recurringMonthly) {
      params.set(`${prefix}[price_data][recurring][interval]`, 'month')
    }
  })
  return params
}

async function stripeRequest(path: string, init: RequestInit): Promise<Response> {
  const { secretKey } = readCredentials()
  if (!secretKey) {
    throw new StripeError('missing_credentials', 'STRIPE_SECRET_KEY is not configured')
  }
  const url = `${STRIPE_API}${path}`
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        ...init.headers,
      },
      signal: AbortSignal.timeout(STRIPE_REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    if (isTimeoutError(error)) throw new StripeError('timeout', 'Stripe request timed out')
    throw error
  }
  return response
}

async function readStripeError(response: Response, code: StripeErrorCode): Promise<never> {
  const body = await response.text().catch(() => '')
  // Stripe error bodies carry the API's own message; keep it out of the
  // client contract but loud on the server log.
  const sanitized = body.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').slice(0, 500)
  console.error(`[stripe] api_error (HTTP ${response.status}): ${sanitized}`)
  throw new StripeError(code, `Stripe API responded ${response.status}`)
}

/**
 * Creates a hosted Checkout Session. `mode: 'subscription'` bills the line
 * items monthly (recurring price_data); `mode: 'payment'` bills them once.
 */
export async function createCheckoutSession(input: CreateCheckoutSessionInput): Promise<StripeSessionCreated> {
  const params = lineItemParams(input.lineItems)
  params.set('mode', input.mode)
  params.set('success_url', input.successUrl)
  params.set('cancel_url', input.cancelUrl)
  params.set('client_reference_id', input.externalReference)
  if (input.customerEmail) params.set('customer_email', input.customerEmail)

  const response = await stripeRequest('/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: params.toString(),
  })
  if (response.status === 401 || response.status === 403) {
    await readStripeError(response, 'unauthorized')
  }
  if (!response.ok) {
    await readStripeError(response, 'api_error')
  }

  const record: unknown = await response.json().catch(() => undefined)
  if (typeof record !== 'object' || record === null) {
    throw new StripeError('invalid_response', 'Stripe response is not a JSON object')
  }
  const id = (record as Record<string, unknown>).id
  const url = (record as Record<string, unknown>).url
  if (typeof id !== 'string' || !id) {
    throw new StripeError('invalid_response', 'Stripe response is missing session id')
  }
  if (!isAllowedCheckoutUrl(url)) {
    throw new StripeError('invalid_url', 'Stripe returned an unusable checkout URL')
  }
  return { id, checkoutUrl: url }
}

/** Fetches a Checkout Session and returns a sanitized subset; undefined on 404. */
export async function getCheckoutSession(sessionId: string): Promise<CheckoutSessionStatus | undefined> {
  const response = await stripeRequest(
    `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { method: 'GET' },
  )
  if (response.status === 404) return undefined
  if (response.status === 401 || response.status === 403) {
    await readStripeError(response, 'unauthorized')
  }
  if (!response.ok) {
    await readStripeError(response, 'api_error')
  }
  const record: unknown = await response.json().catch(() => undefined)
  if (typeof record !== 'object' || record === null) {
    throw new StripeError('invalid_response', 'Stripe response is not a JSON object')
  }
  const r = record as Record<string, unknown>
  if (typeof r.id !== 'string') throw new StripeError('invalid_response', 'Stripe session is missing id')
  return {
    id: r.id,
    status: typeof r.status === 'string' ? r.status : null,
    paymentStatus: typeof r.payment_status === 'string' ? r.payment_status : null,
    customerEmail: typeof r.customer_email === 'string' ? r.customer_email : null,
    amountTotal: typeof r.amount_total === 'number' ? r.amount_total / 100 : null,
    currency: typeof r.currency === 'string' ? r.currency : null,
    clientReferenceId: typeof r.client_reference_id === 'string' ? r.client_reference_id : null,
  }
}

/**
 * USD subscription quote (en-US Stripe checkout). Mirrors the BRL quote's
 * validation and error codes; amounts are derived from the catalog at the
 * 5:1 reference rate or the stored USD reference. Never trusts the browser.
 */
export type UsdLineItem = { id: CatalogServiceId; name: string; monthlyUSD: number }

export type UsdPriceQuote = {
  items: UsdLineItem[]
  totalUSD: number
  reason: string
  externalReference: string
}

/**
 * Computes the authoritative USD monthly quote for the en-US Stripe checkout.
 * Runs the shared quote pipeline (buildQuote — the same validation, ordering,
 * deduplication, zero-total guard, rounding and externalReference contract as
 * the BRL path) with a USD amount resolver: stored USD references or the 5:1
 * BRL conversion for fixed services, the US$ fee for ads-spend services.
 */
export function computeUsdMonthlyQuote(
  serviceIds: unknown,
  config: unknown,
  locale: Locale,
  catalog: Record<CatalogServiceId, CatalogService> = SERVICES,
): UsdPriceQuote {
  const quote = buildQuote(serviceIds, config, locale, catalog, (id, service, rawConfig) => {
    if (service.pricing.kind === 'fixed') {
      const usd = service.pricing.monthlyUSD ?? service.pricing.monthlyBRL / BRL_USD_REFERENCE_RATE
      return Math.round(usd * 100) / 100
    }
    if (service.pricing.kind === 'ads-spend') return adSpendFeeUSD(monthlyAdSpendOf(rawConfig, id))
    // quote-only services never reach this point (rejected in buildQuote).
    throw new PricingError('quote_only_service', `Service is quote-only: ${id}`)
  })
  return {
    items: quote.items.map((item) => ({ id: item.id, name: item.name, monthlyUSD: item.amount })),
    totalUSD: quote.total,
    reason: quote.reason,
    externalReference: quote.externalReference,
  }
}

/* ─── Webhook signature verification ─────────────────────────────────── */

export const STRIPE_SIGNATURE_MAX_AGE_SECONDS = 5 * 60

/** Parses `t=<ts>,v1=<hex>` from the `stripe-signature` header. */
export function parseStripeSignatureHeader(value: string | null | undefined): { ts: number; v1: string } | undefined {
  if (!value) return undefined
  const ts = Number(/\bt=(\d+)/.exec(value)?.[1])
  const v1 = /\bv1=([0-9a-fA-F]+)/.exec(value)?.[1]
  if (!Number.isFinite(ts) || !v1) return undefined
  return { ts, v1 }
}

function hexEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex')
  const bb = Buffer.from(b, 'hex')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/**
 * Verifies a Stripe webhook signature: signed payload is `<ts>.<body>`,
 * HMAC-SHA256 with the webhook secret. Timestamp recency is checked by the
 * caller (replay protection).
 */
export function verifyStripeWebhookSignature(input: {
  payload: string
  signatureHeader: string | null | undefined
  secret: string
}): { ok: true; ts: number } | { ok: false; code: 'missing_secret' | 'bad_signature' } {
  if (!input.secret) return { ok: false, code: 'missing_secret' }
  const parsed = parseStripeSignatureHeader(input.signatureHeader)
  if (!parsed) return { ok: false, code: 'bad_signature' }
  const signed = `${parsed.ts}.${input.payload}`
  const expected = createHmac('sha256', input.secret).update(signed).digest('hex')
  if (!hexEqual(expected, parsed.v1)) return { ok: false, code: 'bad_signature' }
  return { ok: true, ts: parsed.ts }
}
