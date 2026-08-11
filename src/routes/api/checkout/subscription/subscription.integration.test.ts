import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './+server'
import { MercadoPagoError, createSubscription } from '$lib/server/mercadoPago'
import { checkoutBackUrl, isValidEmail } from '$lib/server/checkout'

vi.mock('$lib/server/mercadoPago', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/server/mercadoPago')>()
  return { ...actual, createSubscription: vi.fn() }
})

const mockCreateSubscription = vi.mocked(createSubscription)

const requestEvent = (body: unknown) =>
  ({
    request: new Request('http://localhost/api/checkout/subscription', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  }) as Parameters<typeof POST>[0]

const validBody = {
  email: 'customer@example.com',
  serviceIds: ['seo-content', 'hosting'],
  idempotencyKey: 'attempt-1',
  config: {},
}

describe('POST /api/checkout/subscription', () => {
  beforeEach(() => {
    vi.stubEnv('PUBLIC_SITE_URL', 'https://advanceddigitalmarketingltda.com')
    mockCreateSubscription.mockReset()
    mockCreateSubscription.mockResolvedValue({
      id: 'sub-1',
      checkoutUrl: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=sub-1',
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('creates the subscription with the server-computed total and returns the checkout URL', async () => {
    const response = await POST(requestEvent(validBody))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      checkoutUrl: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=sub-1',
    })
    expect(mockCreateSubscription).toHaveBeenCalledWith({
      email: 'customer@example.com',
      reason: 'Conteúdo SEO + Hospedagem',
      externalReference: 'seo-content+hosting',
      amountBRL: 2750,
      backUrl: 'https://advanceddigitalmarketingltda.com/pt-br/checkout/complete/',
      idempotencyKey: 'attempt-1',
    })
  })

  it('never trusts a client-supplied total — the Mercado Pago amount is the server price', async () => {
    const response = await POST(
      requestEvent({
        ...validBody,
        total: 1,
        serviceIds: ['paid-search'],
        config: { 'paid-search': { monthlyAdSpend: 10000 } },
      }),
    )
    expect(response.status).toBe(200)
    expect(mockCreateSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ amountBRL: 1000 }), // 10% of R$10,000 spend
    )
  })

  it('rejects an invalid email without calling Mercado Pago', async () => {
    for (const email of ['', 'not-an-email', 'a@b', 'x@y.c', 'spaces in@email.com']) {
      const response = await POST(requestEvent({ ...validBody, email }))
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'invalid_email' })
    }
    expect(mockCreateSubscription).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON', async () => {
    const event = {
      request: new Request('http://localhost/api/checkout/subscription', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not json',
      }),
    } as Parameters<typeof POST>[0]
    const response = await POST(event)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid_json' })
  })

  it('rejects unknown, quote-only and empty selections', async () => {
    const cases: Array<[unknown, string]> = [
      [['not-a-service'], 'invalid_service'],
      [['seo-content', 'nope'], 'invalid_service'],
      [['ai-automation'], 'quote_only_service'],
      [[], 'no_services_selected'],
    ]
    for (const [serviceIds, code] of cases) {
      const response = await POST(requestEvent({ ...validBody, serviceIds }))
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: code })
    }
    expect(mockCreateSubscription).not.toHaveBeenCalled()
  })

  it('rejects invalid ad-spend configuration', async () => {
    const response = await POST(
      requestEvent({
        ...validBody,
        serviceIds: ['meta-ads'],
        config: { 'meta-ads': { monthlyAdSpend: 'lots' } },
      }),
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid_ad_spend' })
  })

  it('requires an idempotency key (duplicate-submission guard)', async () => {
    for (const idempotencyKey of [undefined, '', 'x'.repeat(129)]) {
      const response = await POST(requestEvent({ ...validBody, idempotencyKey }))
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'invalid_idempotency_key' })
    }
    expect(mockCreateSubscription).not.toHaveBeenCalled()
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
      mockCreateSubscription.mockRejectedValueOnce(error)
      const response = await POST(requestEvent(validBody))
      expect(response.status).toBe(status)
      const body = (await response.json()) as Record<string, unknown>
      expect(body).toEqual({ error: error.code })
      expect(JSON.stringify(body)).not.toContain('Bearer')
      expect(JSON.stringify(body)).not.toContain(error.message)
    }
  })

  it('re-throws unexpected errors (server logs them)', async () => {
    mockCreateSubscription.mockRejectedValueOnce(new Error('boom'))
    await expect(POST(requestEvent(validBody))).rejects.toThrow('boom')
  })
})

describe('checkoutBackUrl', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('builds the back URL from PUBLIC_SITE_URL', () => {
    vi.stubEnv('PUBLIC_SITE_URL', 'https://example.com')
    expect(checkoutBackUrl()).toBe('https://example.com/pt-br/checkout/complete/')
  })

  it('falls back to the canonical origin loudly when PUBLIC_SITE_URL is missing', () => {
    vi.stubEnv('PUBLIC_SITE_URL', '')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const url = checkoutBackUrl()
      expect(url).toBe('https://advanceddigitalmarketingltda.com/pt-br/checkout/complete/')
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('PUBLIC_SITE_URL is not set'),
      )
    } finally {
      errorSpy.mockRestore()
    }
  })
})

describe('isValidEmail', () => {
  it('accepts well-formed addresses and rejects everything else', () => {
    expect(isValidEmail('ada@example.com')).toBe(true)
    expect(isValidEmail('ada+tag@sub.example.co')).toBe(true)
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('ada@')).toBe(false)
    expect(isValidEmail('@example.com')).toBe(false)
    expect(isValidEmail('ada example.com')).toBe(false)
    expect(isValidEmail(42)).toBe(false)
    expect(isValidEmail(`${'a'.repeat(250)}@example.com`)).toBe(false)
  })
})
