import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './+server'

/**
 * End-to-end flow through the REAL createSubscription: only global fetch is
 * stubbed. Proves the spec's core trust boundary — browser manipulation of the
 * request cannot change the amount Mercado Pago is told to bill.
 */
describe('POST /api/checkout/subscription — real path', () => {
  beforeEach(() => {
    // Distinct values so the credential assertion can prove the Bearer token
    // comes from MERCADO_PAGO_ACCESS_TOKEN — not from the sandbox variable.
    vi.stubEnv('MERCADO_PAGO_ACCESS_TOKEN', 'TEST-access-token')
    vi.stubEnv('MERCADO_PAGO_SANDBOX_ACCESS_TOKEN', 'TEST-sandbox-token')
    vi.stubEnv('PUBLIC_SITE_URL', 'https://example.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('sends the server-computed BRL total to Mercado Pago even when the browser lies about the total', async () => {
    let captured: { url: string; init?: RequestInit } | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL, init?: RequestInit) => {
        captured = { url: String(url), init }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'sub-9',
              init_point: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=sub-9',
              sandbox_init_point:
                'https://sandbox.mercadopago.com.br/subscriptions/checkout?preapproval_id=sub-9',
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }) as unknown as typeof fetch,
    )

    const event = {
      request: new Request('http://localhost/api/checkout/subscription', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'customer@example.com',
          serviceIds: ['seo-content', 'backlinks', 'hosting', 'paid-search', 'meta-ads'],
          config: {
            'paid-search': { monthlyAdSpend: 10000 },
            'meta-ads': { monthlyAdSpend: 3000 },
          },
          idempotencyKey: '00000000-0000-4000-8000-000000000000',
          total: 1, // browser tampering attempt — must be ignored
        }),
      }),
      getClientAddress: () => '127.0.0.1',
    } as Parameters<typeof POST>[0]

    const response = await POST(event)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      checkoutUrl: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=sub-9',
    })

    expect(captured?.url).toBe('https://api.mercadopago.com/preapproval')
    const headers = captured?.init?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer TEST-access-token')
    expect(headers['X-Idempotency-Key']).toBe('00000000-0000-4000-8000-000000000000')

    const sentBody = JSON.parse(String(captured?.init?.body)) as Record<string, unknown>
    expect(sentBody.payer_email).toBe('customer@example.com')
    expect(sentBody.status).toBe('pending')
    expect(sentBody.back_url).toBe('https://example.com/pt-br/checkout/complete/')
    expect(sentBody.reason).toBe(
      'Conteúdo SEO + Backlinks + Hospedagem + Gestão de Google Ads + Gestão de Meta Ads',
    )
    expect(sentBody.external_reference).toBe('seo-content+backlinks+hosting+paid-search+meta-ads')
    expect(sentBody.auto_recurring).toEqual({
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: 6800, // 2000 + 3000 + 300 + max(1000,500) + max(300,500)
      currency_id: 'BRL',
    })
  })

  it('switches to the sandbox checkout when the sandbox token matches the access token', async () => {
    // Sandbox mode is detected by exact token equality (src/lib/server/sandbox.ts).
    vi.stubEnv('MERCADO_PAGO_SANDBOX_ACCESS_TOKEN', 'TEST-access-token')

    let captured: { url: string; init?: RequestInit } | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL, init?: RequestInit) => {
        captured = { url: String(url), init }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'sub-9',
              init_point: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=sub-9',
              sandbox_init_point:
                'https://sandbox.mercadopago.com.br/subscriptions/checkout?preapproval_id=sub-9',
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }) as unknown as typeof fetch,
    )

    const event = {
      request: new Request('http://localhost/api/checkout/subscription', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'customer@example.com',
          serviceIds: ['seo-content'],
          idempotencyKey: '00000000-0000-4000-8000-000000000000',
          config: {},
        }),
      }),
      getClientAddress: () => '127.0.0.1',
    } as Parameters<typeof POST>[0]

    const response = await POST(event)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      checkoutUrl: 'https://sandbox.mercadopago.com.br/subscriptions/checkout?preapproval_id=sub-9',
    })
    const headers = captured?.init?.headers as Record<string, string>
    // The Bearer credential still comes from MERCADO_PAGO_ACCESS_TOKEN.
    expect(headers.Authorization).toBe('Bearer TEST-access-token')
  })
})
