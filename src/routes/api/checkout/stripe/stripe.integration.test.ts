/**
 * Guards POST /api/checkout/stripe (en-US, USD): server-derived pricing for
 * subscriptions and one-time builds, validation, rate limiting, and Stripe
 * session creation (mocked at the fetch boundary).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './+server'
import { resetRateLimitBuckets } from '$lib/server/rate-limit'

const sessionResponse = (overrides: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
      ...overrides,
    }),
    { status: 200 },
  )

const requestEvent = (body: unknown) =>
  ({
    request: new Request('http://localhost/api/checkout/stripe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    getClientAddress: () => '127.0.0.1',
  }) as Parameters<typeof POST>[0]

const UUID = '00000000-0000-4000-8000-000000000000'

const validSubscription = {
  flow: 'subscription',
  email: 'customer@example.com',
  serviceIds: ['seo-content', 'hosting'],
  config: {},
  idempotencyKey: UUID,
  locale: 'en-US',
}

describe('POST /api/checkout/stripe', () => {
  beforeEach(() => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123')
    vi.stubEnv('PUBLIC_SITE_URL', 'https://advanceddigitalmarketingltda.com')
    resetRateLimitBuckets()
    vi.stubGlobal('fetch', vi.fn(() => sessionResponse()))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    resetRateLimitBuckets()
  })

  it('creates a subscription session with server-priced USD line items', async () => {
    const response = await POST(requestEvent(validSubscription))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_1' })

    const fetchMock = vi.mocked(fetch)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions')
    const body = new URLSearchParams(String(init.body))
    expect(body.get('mode')).toBe('subscription')
    expect(body.get('client_reference_id')).toBe('seo-content+hosting')
    expect(body.get('customer_email')).toBe('customer@example.com')
    // 400 USD + 60 USD at the 5:1 reference / stored USD values.
    expect(body.get('line_items[0][price_data][unit_amount]')).toBe('40000')
    expect(body.get('line_items[1][price_data][unit_amount]')).toBe('6000')
    expect(body.get('line_items[0][price_data][recurring][interval]')).toBe('month')
  })

  it('creates a one-time build session at the USD build price', async () => {
    const response = await POST(
      requestEvent({ flow: 'build', type: 'ecommerce', kind: 'migration', idempotencyKey: UUID, locale: 'en-US' }),
    )
    expect(response.status).toBe(200)
    const fetchMock = vi.mocked(fetch)
    const body = new URLSearchParams(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(body.get('mode')).toBe('payment')
    expect(body.get('client_reference_id')).toBe('website-build:ecommerce:migration')
    // 1500 base × 2 migration = $3000.
    expect(body.get('line_items[0][price_data][unit_amount]')).toBe('300000')
  })

  it('rejects invalid flows, emails and idempotency keys with 400', async () => {
    const cases = [
      [{ flow: 'nope', idempotencyKey: UUID, locale: 'en-US' }, 'invalid_build'],
      [{ ...validSubscription, email: 'nope' }, 'invalid_email'],
      [{ ...validSubscription, idempotencyKey: 'not-a-uuid' }, 'invalid_idempotency_key'],
      [{ flow: 'subscription', email: 'a@b.com', serviceIds: [], config: {}, idempotencyKey: UUID, locale: 'en-US' }, 'no_services_selected'],
      [{ flow: 'build', type: 'hovercraft', kind: 'new', idempotencyKey: UUID, locale: 'en-US' }, 'invalid_build'],
      [{ ...validSubscription, locale: 'pt-BR' }, 'invalid_locale'],
      [{ ...validSubscription, locale: 'fr-FR' }, 'invalid_locale'],
      [{ ...validSubscription, locale: undefined }, 'invalid_locale'],
    ] as const
    for (const [body, code] of cases) {
      const response = await POST(requestEvent(body))
      expect(response.status, String(code)).toBe(400)
      expect(await response.json()).toEqual({ error: code })
    }
  })

  it('returns 503 missing_credentials when STRIPE_SECRET_KEY is unset', async () => {
    vi.unstubAllEnvs()
    const response = await POST(requestEvent(validSubscription))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'missing_credentials' })
  })

  it('maps Stripe upstream failures to stable statuses', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Response('{"error":{"message":"nope"}}', { status: 401 })))
    const response = await POST(requestEvent(validSubscription))
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'unauthorized' })
  })

  it('rate-limits repeated creations from the same client', async () => {
    for (let i = 0; i < 10; i += 1) {
      const ok = await POST(requestEvent(validSubscription))
      expect(ok.status).toBe(200)
    }
    const limited = await POST(requestEvent(validSubscription))
    expect(limited.status).toBe(429)
  })
})
