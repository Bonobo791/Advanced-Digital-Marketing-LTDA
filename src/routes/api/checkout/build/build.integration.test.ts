import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './+server'
import { MercadoPagoError, createCheckoutPreference } from '$lib/server/mercadoPago'
import { resetRateLimitBuckets } from '$lib/server/rate-limit'
import { WEBSITE_BUILD_CHECKOUT_PAYMENT_METHODS } from '$lib/website-builds'

vi.mock('$lib/server/mercadoPago', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/server/mercadoPago')>()
  return { ...actual, createCheckoutPreference: vi.fn() }
})

const mockCreateCheckoutPreference = vi.mocked(createCheckoutPreference)

const requestEvent = (body: unknown) =>
  ({
    request: new Request('http://localhost/api/checkout/build', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    getClientAddress: () => '127.0.0.1',
  }) as Parameters<typeof POST>[0]

const UUID = '00000000-0000-4000-8000-000000000000'

const validBody = {
  type: 'website',
  kind: 'new',
  idempotencyKey: UUID,
  locale: 'pt-BR',
}

describe('POST /api/checkout/build', () => {
  beforeEach(() => {
    vi.stubEnv('PUBLIC_SITE_URL', 'https://advanceddigitalmarketingltda.com')
    resetRateLimitBuckets()
    mockCreateCheckoutPreference.mockReset()
    mockCreateCheckoutPreference.mockResolvedValue({
      id: 'pref-1',
      checkoutUrl: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1',
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    resetRateLimitBuckets()
  })

  it('creates the preference with the server-computed BRL price and returns the checkout URL', async () => {
    const response = await POST(requestEvent(validBody))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      checkoutUrl: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1',
    })
    expect(mockCreateCheckoutPreference).toHaveBeenCalledWith({
      title: 'Desenvolvimento de Site',
      amountBRL: 3000,
      externalReference: 'website-build:website:new',
      backUrls: {
        success: 'https://advanceddigitalmarketingltda.com/pt-br/checkout/complete/',
        failure: 'https://advanceddigitalmarketingltda.com/pt-br/checkout/complete/',
        pending: 'https://advanceddigitalmarketingltda.com/pt-br/checkout/complete/',
      },
      idempotencyKey: UUID,
      paymentMethods: WEBSITE_BUILD_CHECKOUT_PAYMENT_METHODS,
    })
  })

  it('prices ecommerce and migration builds from the authoritative BRL table', async () => {
    for (const [type, kind, expectedAmount, expectedReference, expectedTitle] of [
      ['website', 'new', 3000, 'website-build:website:new', 'Desenvolvimento de Site'],
      ['ecommerce', 'new', 6000, 'website-build:ecommerce:new', 'Desenvolvimento de Site E-commerce'],
      ['website', 'migration', 6000, 'website-build:website:migration', 'Desenvolvimento de Site (Migração)'],
      ['ecommerce', 'migration', 12000, 'website-build:ecommerce:migration', 'Desenvolvimento de Site E-commerce (Migração)'],
    ] as const) {
      mockCreateCheckoutPreference.mockClear()
      const response = await POST(requestEvent({ ...validBody, type, kind }))
      expect(response.status).toBe(200)
      expect(mockCreateCheckoutPreference).toHaveBeenCalledWith(
        expect.objectContaining({ amountBRL: expectedAmount, externalReference: expectedReference, title: expectedTitle }),
      )
    }
  })

  it('never trusts a client-supplied amount — the Mercado Pago price is the server price', async () => {
    const response = await POST(
      requestEvent({
        ...validBody,
        total: 1, // browser tampering attempt — must be ignored
        amount: 1,
      }),
    )
    expect(response.status).toBe(200)
    expect(mockCreateCheckoutPreference).toHaveBeenCalledWith(
      expect.objectContaining({ amountBRL: 3000 }),
    )
  })

  it('rejects unknown build selections without calling Mercado Pago', async () => {
    for (const body of [
      { ...validBody, type: 'shopify' },
      { ...validBody, type: 42 },
      { ...validBody, kind: 'redesign' },
      { ...validBody, kind: undefined },
      { ...validBody, type: undefined },
    ]) {
      const response = await POST(requestEvent(body))
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'invalid_build' })
    }
    expect(mockCreateCheckoutPreference).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON', async () => {
    const event = {
      request: new Request('http://localhost/api/checkout/build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not json',
      }),
    } as Parameters<typeof POST>[0]
    const response = await POST(event)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid_json' })
  })

  it('requires a UUID v4 idempotency key (duplicate-submission guard)', async () => {
    for (const idempotencyKey of [undefined, '', 'attempt-1', 'x'.repeat(129), 'not-a-uuid']) {
      const response = await POST(requestEvent({ ...validBody, idempotencyKey }))
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'invalid_idempotency_key' })
    }
    expect(mockCreateCheckoutPreference).not.toHaveBeenCalled()
  })

  it('maps Mercado Pago failures to stable status codes without leaking internals', async () => {
    const cases: Array<[MercadoPagoError, number]> = [
      [new MercadoPagoError('unauthorized', 'x'), 502],
      [new MercadoPagoError('api_error', 'x'), 502],
      [new MercadoPagoError('invalid_response', 'x'), 502],
      [new MercadoPagoError('missing_init_point', 'x'), 502],
      [new MercadoPagoError('invalid_init_point', 'x'), 502],
      [new MercadoPagoError('timeout', 'x'), 503],
      [new MercadoPagoError('missing_credentials', 'x'), 503],
    ]
    for (const [error, status] of cases) {
      mockCreateCheckoutPreference.mockRejectedValueOnce(error)
      const response = await POST(requestEvent(validBody))
      expect(response.status).toBe(status)
      const body = (await response.json()) as Record<string, unknown>
      expect(body).toEqual({ error: error.code })
      expect(JSON.stringify(body)).not.toContain('Bearer')
      expect(JSON.stringify(body)).not.toContain(error.message)
    }
  })

  it('re-throws unexpected errors (server logs them)', async () => {
    mockCreateCheckoutPreference.mockRejectedValueOnce(new Error('boom'))
    await expect(POST(requestEvent(validBody))).rejects.toThrow('boom')
  })

  it('rejects repeated requests from the same IP with 429 after the window fills', async () => {
    for (let i = 0; i < 10; i += 1) {
      const ok = await POST(requestEvent(validBody))
      expect(ok.status).toBe(200)
    }
    expect(mockCreateCheckoutPreference).toHaveBeenCalledTimes(10)

    const rejected = await POST(requestEvent(validBody))
    expect(rejected.status).toBe(429)
    expect(await rejected.json()).toEqual({ error: 'rate_limited' })
    expect(mockCreateCheckoutPreference).toHaveBeenCalledTimes(10)

    // A different IP is unaffected.
    const otherIp = {
      request: new Request('http://localhost/api/checkout/build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validBody),
      }),
      getClientAddress: () => '10.0.0.2',
    } as Parameters<typeof POST>[0]
    const ok = await POST(otherIp)
    expect(ok.status).toBe(200)
  })

  it('fails loudly when no client IP is resolvable, instead of pooling unidentified clients', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const event = {
        request: new Request('http://localhost/api/checkout/build', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(validBody),
        }),
        getClientAddress: (): string => {
          throw new Error('adapter provides no client address')
        },
      } as Parameters<typeof POST>[0]

      const response = await POST(event)
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ error: 'client_address_unavailable' })
      expect(mockCreateCheckoutPreference).not.toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('cannot determine client IP for rate limiting'),
      )
    } finally {
      errorSpy.mockRestore()
    }
  })
})
