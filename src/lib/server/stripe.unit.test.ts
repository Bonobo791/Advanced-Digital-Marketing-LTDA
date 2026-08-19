/**
 * Guards the Stripe Checkout client (src/lib/server/stripe.ts): USD quote
 * derivation at the 5:1 reference rate, Checkout Session creation (form
 * body, auth, URL validation, error mapping) and webhook signature
 * verification.
 */
import { createHmac } from 'node:crypto'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { SERVICES } from '$lib/catalog'
import {
  computeUsdMonthlyQuote,
  createCheckoutSession,
  getCheckoutSession,
  isAllowedCheckoutUrl,
  parseStripeSignatureHeader,
  verifyStripeWebhookSignature,
} from './stripe'
import { PricingError } from './pricing'

const sessionResponse = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    id: 'cs_test_123',
    url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    ...overrides,
  })

describe('computeUsdMonthlyQuote', () => {
  it('derives USD amounts from the stored USD references', () => {
    const quote = computeUsdMonthlyQuote(['seo-content', 'hosting'], {}, 'en-US')
    expect(quote.totalUSD).toBe(460)
    expect(quote.externalReference).toBe('seo-content+hosting')
    expect(quote.reason).toBe('SEO Content + Hosting')
  })

  it('applies the USD ad-spend rule with the $100 minimum', () => {
    const above = computeUsdMonthlyQuote(['paid-search'], { 'paid-search': { monthlyAdSpend: 2000 } }, 'en-US')
    expect(above.totalUSD).toBe(200)
    const atFloor = computeUsdMonthlyQuote(['meta-ads'], { 'meta-ads': { monthlyAdSpend: 500 } }, 'en-US')
    expect(atFloor.totalUSD).toBe(100)
    const zero = computeUsdMonthlyQuote(['meta-ads'], { 'meta-ads': { monthlyAdSpend: 0 } }, 'en-US')
    expect(zero.totalUSD).toBe(100)
  })

  it('falls back to the 5:1 reference rate when no USD reference is stored', () => {
    const catalog = {
      ...SERVICES,
      'seo-content': {
        ...SERVICES['seo-content'],
        pricing: { kind: 'fixed' as const, monthlyBRL: 2000 },
      },
    }
    const quote = computeUsdMonthlyQuote(['seo-content'], {}, 'en-US', catalog)
    expect(quote.totalUSD).toBe(400)
  })

  function codeOf(fn: () => unknown): string | undefined {
    try {
      fn()
    } catch (error) {
      return (error as { code?: string }).code
    }
    return undefined
  }

  it('rejects invalid selections with the same codes as the BRL quote', () => {
    expect(codeOf(() => computeUsdMonthlyQuote([], {}, 'en-US'))).toBe('no_services_selected')
    expect(codeOf(() => computeUsdMonthlyQuote(['nope'], {}, 'en-US'))).toBe('invalid_service')
    expect(codeOf(() => computeUsdMonthlyQuote(['ai-automation'], {}, 'en-US'))).toBe('quote_only_service')
    expect(codeOf(() => computeUsdMonthlyQuote(['paid-search'], { 'paid-search': { monthlyAdSpend: 'x' } }, 'en-US'))).toBe(
      'invalid_ad_spend',
    )
    expect(() => computeUsdMonthlyQuote([], {}, 'en-US')).toThrow(PricingError)
  })
})

describe('createCheckoutSession', () => {
  const input = {
    mode: 'subscription' as const,
    lineItems: [
      { name: 'SEO Content', unitAmountUSD: 400, quantity: 1, recurringMonthly: true },
      { name: 'Hosting', unitAmountUSD: 60, quantity: 1, recurringMonthly: true },
    ],
    externalReference: 'seo-content+hosting',
    successUrl: 'https://advanceddigitalmarketingltda.com/checkout/complete/',
    cancelUrl: 'https://advanceddigitalmarketingltda.com/services/',
    customerEmail: 'customer@example.com',
    idempotencyKey: '00000000-0000-4000-8000-000000000000',
  }

  beforeEach(() => vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123'))
  afterEach(() => vi.unstubAllEnvs())

  it('POSTs a form-encoded session with recurring price_data and returns the URL', async () => {
    const fetchImpl = vi.fn(async () => new Response(sessionResponse(), { status: 200 }))
    vi.stubGlobal('fetch', fetchImpl)

    const session = await createCheckoutSession(input)
    expect(session).toEqual({ id: 'cs_test_123', checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_123' })

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test_123')
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe(input.idempotencyKey)
    const body = new URLSearchParams(String(init.body))
    expect(body.get('mode')).toBe('subscription')
    expect(body.get('success_url')).toBe(input.successUrl)
    expect(body.get('client_reference_id')).toBe('seo-content+hosting')
    expect(body.get('customer_email')).toBe('customer@example.com')
    expect(body.get('line_items[0][price_data][currency]')).toBe('usd')
    expect(body.get('line_items[0][price_data][unit_amount]')).toBe('40000')
    expect(body.get('line_items[0][price_data][recurring][interval]')).toBe('month')
    expect(body.get('line_items[1][price_data][unit_amount]')).toBe('6000')
  })

  it('builds a one-time payment session without recurring data', async () => {
    const fetchImpl = vi.fn(async () => new Response(sessionResponse(), { status: 200 }))
    vi.stubGlobal('fetch', fetchImpl)
    await createCheckoutSession({
      ...input,
      mode: 'payment',
      lineItems: [{ name: 'Website Development', unitAmountUSD: 750, quantity: 1, recurringMonthly: false }],
    })
    const body = new URLSearchParams(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(body.get('mode')).toBe('payment')
    expect(body.get('line_items[0][price_data][recurring][interval]')).toBeNull()
    expect(body.get('line_items[0][price_data][unit_amount]')).toBe('75000')
  })

  it('fails loudly with missing_credentials when STRIPE_SECRET_KEY is unset', async () => {
    vi.unstubAllEnvs()
    await expect(createCheckoutSession(input)).rejects.toMatchObject({ code: 'missing_credentials' })
  })

  it('maps 401/403 to unauthorized and other non-2xx to api_error', async () => {
    for (const [status, code] of [[401, 'unauthorized'], [403, 'unauthorized'], [500, 'api_error'], [400, 'api_error']] as const) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":{"message":"nope"}}', { status })))
      await expect(createCheckoutSession(input)).rejects.toMatchObject({ code })
    }
  })

  it('rejects a checkout URL on a non-Stripe host', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(sessionResponse({ url: 'https://evil.example.com/pay' }), { status: 200 })),
    )
    await expect(createCheckoutSession(input)).rejects.toMatchObject({ code: 'invalid_url' })
  })

  it('rejects a response without a usable session id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/pay/x' }), { status: 200 })))
    await expect(createCheckoutSession(input)).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('maps network timeouts to timeout', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('The operation timed out', 'TimeoutError') }))
    await expect(createCheckoutSession(input)).rejects.toMatchObject({ code: 'timeout' })
  })
})

describe('isAllowedCheckoutUrl', () => {
  it('accepts only HTTPS Stripe checkout hosts', () => {
    expect(isAllowedCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test_1')).toBe(true)
    expect(isAllowedCheckoutUrl('http://checkout.stripe.com/x')).toBe(false)
    expect(isAllowedCheckoutUrl('https://evil.example.com')).toBe(false)
    expect(isAllowedCheckoutUrl('not a url')).toBe(false)
  })
})

describe('getCheckoutSession', () => {
  beforeEach(() => vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123'))
  afterEach(() => vi.unstubAllEnvs())

  it('returns a sanitized subset', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            id: 'cs_test_1',
            status: 'complete',
            payment_status: 'paid',
            customer_email: 'customer@example.com',
            amount_total: 46000,
            currency: 'usd',
            client_reference_id: 'seo-content+hosting',
            metadata: { secret: 'x' },
          }),
          { status: 200 },
        ),
      ),
    )
    const session = await getCheckoutSession('cs_test_1')
    expect(session).toEqual({
      id: 'cs_test_1',
      status: 'complete',
      paymentStatus: 'paid',
      customerEmail: 'customer@example.com',
      amountTotal: 460,
      currency: 'usd',
      clientReferenceId: 'seo-content+hosting',
    })
  })

  it('returns undefined for a 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
    await expect(getCheckoutSession('cs_missing')).resolves.toBeUndefined()
  })
})

describe('verifyStripeWebhookSignature', () => {
  const SECRET = 'whsec_test'

  it('accepts a correctly signed payload', () => {
    const ts = Math.floor(Date.now() / 1000)
    const payload = JSON.stringify({ id: 'evt_1' })
    const v1 = createHmac('sha256', SECRET).update(`${ts}.${payload}`).digest('hex')
    const result = verifyStripeWebhookSignature({ payload, signatureHeader: `t=${ts},v1=${v1}`, secret: SECRET })
    expect(result.ok).toBe(true)
  })

  it('rejects a wrong secret or tampered payload', () => {
    const ts = Math.floor(Date.now() / 1000)
    const payload = JSON.stringify({ id: 'evt_1' })
    const v1 = createHmac('sha256', 'other').update(`${ts}.${payload}`).digest('hex')
    expect(verifyStripeWebhookSignature({ payload, signatureHeader: `t=${ts},v1=${v1}`, secret: SECRET })).toEqual({
      ok: false,
      code: 'bad_signature',
    })
  })

  it('reports missing_secret when unset', () => {
    const ts = Math.floor(Date.now() / 1000)
    const v1 = createHmac('sha256', SECRET).update(`${ts}.{}`).digest('hex')
    expect(verifyStripeWebhookSignature({ payload: '{}', signatureHeader: `t=${ts},v1=${v1}`, secret: '' })).toEqual({
      ok: false,
      code: 'missing_secret',
    })
  })

  it('parses the signature header', () => {
    expect(parseStripeSignatureHeader('t=1701340300,v1=abc123')).toEqual({ ts: 1701340300, v1: 'abc123' })
    expect(parseStripeSignatureHeader(null)).toBeUndefined()
  })
})
