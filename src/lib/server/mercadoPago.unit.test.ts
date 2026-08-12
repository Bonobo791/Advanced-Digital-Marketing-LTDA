import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isSandboxAccessToken } from './sandbox'
import {
  CHECKOUT_PRO_PREFERENCES_ENDPOINT,
  PAYMENTS_ENDPOINT,
  PREAPPROVAL_ENDPOINT,
  MercadoPagoError,
  createCheckoutPreference,
  createSubscription,
  getPayment,
  getSubscription,
  isAllowedCheckoutUrl,
  selectInitPoint,
} from './mercadoPago'

const PROD_TOKEN = 'APP_USR-prod-token'
const TEST_TOKEN = 'TEST-test-token'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stubFetch(impl: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl) as unknown as typeof fetch)
}

const SUBSCRIPTION_BODY = {
  reason: 'Conteúdo SEO + Hospedagem',
  external_reference: 'seo-content+hosting',
  payer_email: 'customer@example.com',
  auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 2300, currency_id: 'BRL' },
  back_url: 'https://advanceddigitalmarketingltda.com/pt-br/checkout/complete/',
  status: 'pending',
}

describe('isSandboxAccessToken', () => {
  it('matches only when both tokens are set and equal', () => {
    expect(isSandboxAccessToken(TEST_TOKEN, TEST_TOKEN)).toBe(true)
    expect(isSandboxAccessToken(PROD_TOKEN, TEST_TOKEN)).toBe(false)
    expect(isSandboxAccessToken(TEST_TOKEN, undefined)).toBe(false)
    expect(isSandboxAccessToken(undefined, TEST_TOKEN)).toBe(false)
    expect(isSandboxAccessToken('', '')).toBe(false)
    expect(isSandboxAccessToken(TEST_TOKEN, '')).toBe(false)
  })
})

describe('selectInitPoint', () => {
  const response = { init_point: 'https://www.mercadopago.com.br/x', sandbox_init_point: 'https://sandbox.mercadopago.com.br/x' }

  it('prefers init_point in production', () => {
    expect(selectInitPoint(response, PROD_TOKEN, undefined)).toBe(response.init_point)
    expect(selectInitPoint(response, PROD_TOKEN, TEST_TOKEN)).toBe(response.init_point)
  })

  it('prefers sandbox_init_point when using test credentials', () => {
    expect(selectInitPoint(response, TEST_TOKEN, TEST_TOKEN)).toBe(response.sandbox_init_point)
  })

  it('falls back to init_point when the API omits sandbox_init_point (real preapproval shape)', () => {
    // The Subscriptions API only ever returns init_point — even for test
    // credentials, the checkout environment is resolved server-side from the
    // preapproval, so init_point must be used in sandbox mode too.
    expect(selectInitPoint({ init_point: 'https://www.mercadopago.com.br/x' }, TEST_TOKEN, TEST_TOKEN)).toBe(
      'https://www.mercadopago.com.br/x',
    )
  })

  it('never sends a production customer to a sandbox-only URL', () => {
    // Production credentials but only sandbox_init_point → undefined, not the
    // sandbox URL. A real customer must never be redirected to the sandbox.
    expect(selectInitPoint({ sandbox_init_point: 'https://sandbox.mercadopago.com.br/x' }, PROD_TOKEN, undefined)).toBeUndefined()
    expect(selectInitPoint({}, PROD_TOKEN, undefined)).toBeUndefined()
    expect(selectInitPoint({}, TEST_TOKEN, TEST_TOKEN)).toBeUndefined()
  })
})

describe('isAllowedCheckoutUrl', () => {
  it('accepts HTTPS Mercado Pago hosts', () => {
    expect(isAllowedCheckoutUrl('https://www.mercadopago.com.br/subscriptions/checkout?x=1')).toBe(true)
    expect(isAllowedCheckoutUrl('https://sandbox.mercadopago.com.br/subscriptions/checkout?x=1')).toBe(true)
    expect(isAllowedCheckoutUrl('https://mercadopago.com/x')).toBe(true)
  })

  it('rejects non-HTTPS, foreign and deceptive hosts', () => {
    expect(isAllowedCheckoutUrl('http://www.mercadopago.com.br/x')).toBe(false)
    expect(isAllowedCheckoutUrl('https://evil.example.com/x')).toBe(false)
    expect(isAllowedCheckoutUrl('https://mercadopago.com.evil.com/x')).toBe(false)
    expect(isAllowedCheckoutUrl('https://evilmercadopago.com/x')).toBe(false)
    expect(isAllowedCheckoutUrl('https://mercadopago.com.br.evil.io/x')).toBe(false)
    expect(isAllowedCheckoutUrl('not a url')).toBe(false)
    expect(isAllowedCheckoutUrl(42)).toBe(false)
    expect(isAllowedCheckoutUrl(undefined)).toBe(false)
  })
})

describe('createSubscription', () => {
  beforeEach(() => {
    vi.stubEnv('MERCADO_PAGO_ACCESS_TOKEN', TEST_TOKEN)
    vi.stubEnv('MERCADO_PAGO_SANDBOX_ACCESS_TOKEN', TEST_TOKEN)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  const input = {
    email: 'customer@example.com',
    reason: SUBSCRIPTION_BODY.reason,
    externalReference: SUBSCRIPTION_BODY.external_reference,
    amountBRL: 2300,
    backUrl: SUBSCRIPTION_BODY.back_url,
    idempotencyKey: 'attempt-123',
  }

  it('creates the preapproval with the server-computed amount and returns the checkout URL', async () => {
    let captured: { url: string; init?: RequestInit } | undefined
    stubFetch((url, init) => {
      captured = { url: String(url), init }
      return jsonResponse({ id: '2c9380848a', init_point: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=2c9380848a', sandbox_init_point: 'https://sandbox.mercadopago.com.br/subscriptions/checkout?preapproval_id=2c9380848a' })
    })

    const created = await createSubscription(input)

    expect(captured?.url).toBe(PREAPPROVAL_ENDPOINT)
    expect(captured?.init?.method).toBe('POST')
    const headers = captured?.init?.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${TEST_TOKEN}`)
    expect(headers['X-Idempotency-Key']).toBe('attempt-123')
    expect(JSON.parse(String(captured?.init?.body))).toEqual(SUBSCRIPTION_BODY)
    expect(created).toEqual({
      id: '2c9380848a',
      checkoutUrl: 'https://sandbox.mercadopago.com.br/subscriptions/checkout?preapproval_id=2c9380848a',
    })
  })

  it('uses init_point (not sandbox) with production credentials', async () => {
    vi.stubEnv('MERCADO_PAGO_SANDBOX_ACCESS_TOKEN', '')
    stubFetch(() =>
      jsonResponse({
        id: 'p1',
        init_point: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=p1',
        sandbox_init_point: 'https://sandbox.mercadopago.com.br/subscriptions/checkout?preapproval_id=p1',
      }),
    )
    const created = await createSubscription(input)
    expect(created.checkoutUrl).toContain('www.mercadopago.com.br')
  })

  it('fails loudly when the access token is missing (no request is made)', async () => {
    vi.stubEnv('MERCADO_PAGO_ACCESS_TOKEN', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(createSubscription(input)).rejects.toMatchObject({ code: 'missing_credentials' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps 401/403 to unauthorized', async () => {
    stubFetch(() => jsonResponse({ message: 'invalid_token' }, 401))
    await expect(createSubscription(input)).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('maps other non-2xx responses to api_error', async () => {
    stubFetch(() => jsonResponse({}, 500))
    await expect(createSubscription(input)).rejects.toMatchObject({ code: 'api_error' })
  })

  it('maps network failures to api_error', async () => {
    stubFetch(() => {
      throw new TypeError('fetch failed')
    })
    await expect(createSubscription(input)).rejects.toMatchObject({ code: 'api_error' })
  })

  it('maps request timeouts to timeout', async () => {
    stubFetch(() => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    })
    await expect(createSubscription(input)).rejects.toMatchObject({ code: 'timeout' })
  })

  it('maps malformed response bodies to invalid_response', async () => {
    stubFetch(() => new Response('<html>oops</html>', { status: 200 }))
    await expect(createSubscription(input)).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('rejects a response without an id', async () => {
    stubFetch(() => jsonResponse({ init_point: 'https://www.mercadopago.com.br/x' }))
    await expect(createSubscription(input)).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('rejects a response without an init_point', async () => {
    stubFetch(() => jsonResponse({ id: 's1' }))
    await expect(createSubscription(input)).rejects.toMatchObject({ code: 'missing_init_point' })
  })

  it('rejects an init_point on an unexpected host', async () => {
    // Sandbox mode is active in this suite, so the hostile URL must be the
    // sandbox field for it to be selected (and then rejected by host check).
    stubFetch(() => jsonResponse({ id: 's1', sandbox_init_point: 'https://evil.example.com/x' }))
    await expect(createSubscription(input)).rejects.toMatchObject({ code: 'invalid_init_point' })
  })

  it('throws typed MercadoPagoError instances', async () => {
    stubFetch(() => jsonResponse({}, 500))
    try {
      await createSubscription(input)
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(MercadoPagoError)
      expect((error as MercadoPagoError).code).toBe('api_error')
    }
  })
})

describe('getSubscription', () => {
  beforeEach(() => {
    vi.stubEnv('MERCADO_PAGO_ACCESS_TOKEN', PROD_TOKEN)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('returns a sanitized subscription status', async () => {
    stubFetch(() =>
      jsonResponse({
        id: 's1',
        status: 'authorized',
        reason: 'Conteúdo SEO + Hospedagem',
        external_reference: 'seo-content+hosting',
        payer_email: 'customer@example.com',
        auto_recurring: { transaction_amount: 2300, currency_id: 'BRL' },
        init_point: 'https://www.mercadopago.com.br/secret',
        card_id: 'secret-card',
      }),
    )
    const status = await getSubscription('s1')
    expect(status).toEqual({
      id: 's1',
      status: 'authorized',
      reason: 'Conteúdo SEO + Hospedagem',
      externalReference: 'seo-content+hosting',
      payerEmail: 'customer@example.com',
      transactionAmount: 2300,
      currencyId: 'BRL',
    })
  })

  it('returns undefined for a missing token (no request is made)', async () => {
    vi.stubEnv('MERCADO_PAGO_ACCESS_TOKEN', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(getSubscription('s1')).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns undefined on 404', async () => {
    stubFetch(() => jsonResponse({}, 404))
    await expect(getSubscription('s1')).resolves.toBeUndefined()
  })

  it('maps 401 and 403 to unauthorized', async () => {
    stubFetch(() => jsonResponse({}, 401))
    await expect(getSubscription('s1')).rejects.toMatchObject({ code: 'unauthorized' })
    stubFetch(() => jsonResponse({}, 403))
    await expect(getSubscription('s1')).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('maps request timeouts to timeout', async () => {
    stubFetch(() => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    })
    await expect(getSubscription('s1')).rejects.toMatchObject({ code: 'timeout' })
  })

  it('rejects a response without a string id instead of coercing it', async () => {
    stubFetch(() => jsonResponse({ id: 123, status: 'authorized' }))
    await expect(getSubscription('s1')).rejects.toMatchObject({ code: 'invalid_response' })
    stubFetch(() => jsonResponse({ status: 'authorized' }))
    await expect(getSubscription('s1')).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('maps non-ok responses to api_error', async () => {
    stubFetch(() => jsonResponse({}, 503))
    await expect(getSubscription('s1')).rejects.toMatchObject({ code: 'api_error' })
  })
})

describe('createCheckoutPreference', () => {
  beforeEach(() => {
    vi.stubEnv('MERCADO_PAGO_ACCESS_TOKEN', TEST_TOKEN)
    vi.stubEnv('MERCADO_PAGO_SANDBOX_ACCESS_TOKEN', TEST_TOKEN)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  const input = {
    title: 'Desenvolvimento de Site E-commerce (Migração)',
    amountBRL: 12000,
    externalReference: 'website-build:ecommerce:migration',
    backUrls: {
      success: 'https://advanceddigitalmarketingltda.com/pt-br/checkout/complete/',
      failure: 'https://advanceddigitalmarketingltda.com/pt-br/checkout/complete/',
      pending: 'https://advanceddigitalmarketingltda.com/pt-br/checkout/complete/',
    },
    idempotencyKey: 'attempt-123',
  }

  it('creates the Checkout Pro preference with the server-computed amount and returns the checkout URL', async () => {
    let captured: { url: string; init?: RequestInit } | undefined
    stubFetch((url, init) => {
      captured = { url: String(url), init }
      return jsonResponse({ id: 'pref-1', init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1', sandbox_init_point: 'https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1' })
    })

    const created = await createCheckoutPreference(input)

    expect(captured?.url).toBe(CHECKOUT_PRO_PREFERENCES_ENDPOINT)
    expect(captured?.init?.method).toBe('POST')
    const headers = captured?.init?.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${TEST_TOKEN}`)
    expect(headers['X-Idempotency-Key']).toBe('attempt-123')
    expect(JSON.parse(String(captured?.init?.body))).toEqual({
      items: [{ title: input.title, quantity: 1, unit_price: 12000, currency_id: 'BRL' }],
      back_urls: input.backUrls,
      auto_return: 'approved',
      external_reference: 'website-build:ecommerce:migration',
    })
    expect(created).toEqual({
      id: 'pref-1',
      checkoutUrl: 'https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1',
    })
  })

  it('prefers init_point (not sandbox) with production credentials', async () => {
    vi.stubEnv('MERCADO_PAGO_SANDBOX_ACCESS_TOKEN', '')
    stubFetch(() =>
      jsonResponse({
        id: 'pref-2',
        init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-2',
        sandbox_init_point: 'https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-2',
      }),
    )
    const created = await createCheckoutPreference(input)
    expect(created.checkoutUrl).toContain('www.mercadopago.com.br')
  })

  it('fails loudly when the access token is missing (no request is made)', async () => {
    vi.stubEnv('MERCADO_PAGO_ACCESS_TOKEN', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(createCheckoutPreference(input)).rejects.toMatchObject({ code: 'missing_credentials' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps 401/403, non-2xx, network failures and timeouts to typed codes', async () => {
    stubFetch(() => jsonResponse({}, 401))
    await expect(createCheckoutPreference(input)).rejects.toMatchObject({ code: 'unauthorized' })
    stubFetch(() => jsonResponse({}, 500))
    await expect(createCheckoutPreference(input)).rejects.toMatchObject({ code: 'api_error' })
    stubFetch(() => {
      throw new TypeError('fetch failed')
    })
    await expect(createCheckoutPreference(input)).rejects.toMatchObject({ code: 'api_error' })
    stubFetch(() => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    })
    await expect(createCheckoutPreference(input)).rejects.toMatchObject({ code: 'timeout' })
  })

  it('rejects malformed responses, missing ids and hostile init_points', async () => {
    stubFetch(() => new Response('<html>oops</html>', { status: 200 }))
    await expect(createCheckoutPreference(input)).rejects.toMatchObject({ code: 'invalid_response' })
    stubFetch(() => jsonResponse({ init_point: 'https://www.mercadopago.com.br/x' }))
    await expect(createCheckoutPreference(input)).rejects.toMatchObject({ code: 'invalid_response' })
    stubFetch(() => jsonResponse({ id: 'pref-3' }))
    await expect(createCheckoutPreference(input)).rejects.toMatchObject({ code: 'missing_init_point' })
    // Sandbox mode is active in this suite, so the hostile URL must be the
    // sandbox field for it to be selected (and then rejected by host check).
    stubFetch(() => jsonResponse({ id: 'pref-4', sandbox_init_point: 'https://evil.example.com/x' }))
    await expect(createCheckoutPreference(input)).rejects.toMatchObject({ code: 'invalid_init_point' })
  })
})

describe('getPayment', () => {
  beforeEach(() => {
    vi.stubEnv('MERCADO_PAGO_ACCESS_TOKEN', PROD_TOKEN)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('returns a sanitized payment status', async () => {
    stubFetch(() =>
      jsonResponse({
        id: '1234567890',
        status: 'approved',
        status_detail: 'accredited',
        external_reference: 'website-build:website:new',
        transaction_amount: 3000,
        currency_id: 'BRL',
        payer: { email: 'customer@example.com' },
        card: { last_four_digits: '4242' },
        init_point: 'https://www.mercadopago.com.br/secret',
      }),
    )
    const status = await getPayment('1234567890')
    expect(status).toEqual({
      id: '1234567890',
      status: 'approved',
      statusDetail: 'accredited',
      externalReference: 'website-build:website:new',
      transactionAmount: 3000,
      currencyId: 'BRL',
    })
  })

  it('returns undefined for a missing token (no request is made)', async () => {
    vi.stubEnv('MERCADO_PAGO_ACCESS_TOKEN', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(getPayment('123')).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns undefined on 404', async () => {
    stubFetch(() => jsonResponse({}, 404))
    await expect(getPayment('123')).resolves.toBeUndefined()
  })

  it('maps 401 and 403 to unauthorized', async () => {
    stubFetch(() => jsonResponse({}, 401))
    await expect(getPayment('123')).rejects.toMatchObject({ code: 'unauthorized' })
    stubFetch(() => jsonResponse({}, 403))
    await expect(getPayment('123')).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('rejects a response without a string id instead of coercing it', async () => {
    stubFetch(() => jsonResponse({ id: 123, status: 'approved' }))
    await expect(getPayment('123')).rejects.toMatchObject({ code: 'invalid_response' })
    stubFetch(() => jsonResponse({ status: 'approved' }))
    await expect(getPayment('123')).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('requests the payments endpoint with the encoded id', async () => {
    let capturedUrl = ''
    stubFetch((url) => {
      capturedUrl = String(url)
      return jsonResponse({ id: '1234567890', status: 'approved' })
    })
    await getPayment('1234567890')
    expect(capturedUrl).toBe(`${PAYMENTS_ENDPOINT}/1234567890`)
  })
})
