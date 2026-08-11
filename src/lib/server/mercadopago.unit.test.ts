import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createCheckoutPreference,
  isSandboxAccessToken,
  selectCheckoutInitPoint,
  type CheckoutPreferenceInput,
} from './mercadopago'

const { mockPreferenceCreate } = vi.hoisted(() => ({
  mockPreferenceCreate: vi.fn(),
}))

vi.mock('mercadopago', () => ({
  MercadoPagoConfig: class {
    constructor(public config: { accessToken: string }) {}
  },
  Preference: class {
    create = mockPreferenceCreate
  },
  Payment: class {},
}))

const SAMPLE_RESPONSE = {
  id: 'pref-1',
  init_point: 'https://www.mercadopago.com/checkout/start?pref_id=pref-1',
  sandbox_init_point: 'https://sandbox.mercadopago.com/checkout/pay?pref_id=pref-1',
}

describe('isSandboxAccessToken', () => {
  it('is true only on an exact match', () => {
    expect(isSandboxAccessToken('APP_USR-sandbox', 'APP_USR-sandbox')).toBe(true)
    expect(isSandboxAccessToken('APP_USR-other', 'APP_USR-sandbox')).toBe(false)
    expect(isSandboxAccessToken('TEST-123', 'APP_USR-sandbox')).toBe(false)
    expect(isSandboxAccessToken('APP_USR-x', '')).toBe(false)
    expect(isSandboxAccessToken(undefined, 'APP_USR-sandbox')).toBe(false)
    expect(isSandboxAccessToken('APP_USR-sandbox', undefined)).toBe(false)
    expect(isSandboxAccessToken(undefined, undefined)).toBe(false)
  })
})

describe('selectCheckoutInitPoint', () => {
  it('uses sandbox_init_point when the access token exactly matches the sandbox token', () => {
    expect(selectCheckoutInitPoint(SAMPLE_RESPONSE, 'APP_USR-sandbox', 'APP_USR-sandbox')).toBe(
      SAMPLE_RESPONSE.sandbox_init_point,
    )
  })

  it('falls back to init_point when a sandbox match response lacks sandbox_init_point', () => {
    const response = { id: 'pref-1', init_point: SAMPLE_RESPONSE.init_point }
    expect(selectCheckoutInitPoint(response, 'APP_USR-sandbox', 'APP_USR-sandbox')).toBe(
      response.init_point,
    )
  })

  it('uses init_point in production even when sandbox_init_point is present (regression)', () => {
    // The create-preference response always carries BOTH fields; production
    // must never redirect to the sandbox checkout.
    expect(selectCheckoutInitPoint(SAMPLE_RESPONSE, 'APP_USR-prod', undefined)).toBe(
      SAMPLE_RESPONSE.init_point,
    )
    expect(selectCheckoutInitPoint(SAMPLE_RESPONSE, 'APP_USR-prod', 'APP_USR-sandbox')).toBe(
      SAMPLE_RESPONSE.init_point,
    )
    expect(selectCheckoutInitPoint(SAMPLE_RESPONSE, 'APP_USR-prod', '')).toBe(
      SAMPLE_RESPONSE.init_point,
    )
    expect(selectCheckoutInitPoint(SAMPLE_RESPONSE, 'TEST-123', undefined)).toBe(
      SAMPLE_RESPONSE.init_point,
    )
    expect(selectCheckoutInitPoint(SAMPLE_RESPONSE, undefined, undefined)).toBe(
      SAMPLE_RESPONSE.init_point,
    )
  })

  it('falls back to sandbox_init_point when a production response lacks init_point', () => {
    const response = { id: 'pref-1', sandbox_init_point: SAMPLE_RESPONSE.sandbox_init_point }
    expect(selectCheckoutInitPoint(response, 'APP_USR-prod', undefined)).toBe(
      response.sandbox_init_point,
    )
  })

  it('returns undefined when the response has no redirect URL', () => {
    expect(selectCheckoutInitPoint({}, 'APP_USR-prod', undefined)).toBeUndefined()
  })
})

describe('createCheckoutPreference', () => {
  const input: CheckoutPreferenceInput = {
    externalReference: 'order-1',
    title: 'SEO & GEO',
    currency: 'BRL',
    unitPriceCents: 390_000,
    backUrls: {
      success: 'https://example.com/checkout/success?order_id=order-1',
      pending: 'https://example.com/checkout/pending?order_id=order-1',
      failure: 'https://example.com/checkout/failure?order_id=order-1',
    },
    notificationUrl: 'https://example.com/api/webhooks/mercadopago',
    payerEmail: 'ada@example.com',
  }

  afterEach(() => {
    delete process.env.MERCADO_PAGO_ACCESS_TOKEN
    delete process.env.MERCADO_PAGO_SANDBOX_ACCESS_TOKEN
    mockPreferenceCreate.mockReset()
  })

  it('returns undefined when no access token is configured', async () => {
    delete process.env.MERCADO_PAGO_ACCESS_TOKEN
    await expect(createCheckoutPreference(input)).resolves.toBeUndefined()
    expect(mockPreferenceCreate).not.toHaveBeenCalled()
  })

  it('treats a blank access token as unconfigured', async () => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = ''
    process.env.MERCADO_PAGO_SANDBOX_ACCESS_TOKEN = ''
    await expect(createCheckoutPreference(input)).resolves.toBeUndefined()
    expect(mockPreferenceCreate).not.toHaveBeenCalled()
  })

  it('returns the production init_point for a non-matching token', async () => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = 'APP_USR-prod'
    process.env.MERCADO_PAGO_SANDBOX_ACCESS_TOKEN = 'APP_USR-sandbox'
    mockPreferenceCreate.mockResolvedValue(SAMPLE_RESPONSE)

    await expect(createCheckoutPreference(input)).resolves.toEqual({
      id: 'pref-1',
      initPoint: SAMPLE_RESPONSE.init_point,
    })
  })

  it('returns the sandbox init_point when the token exactly matches the sandbox token', async () => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = 'APP_USR-sandbox'
    process.env.MERCADO_PAGO_SANDBOX_ACCESS_TOKEN = 'APP_USR-sandbox'
    mockPreferenceCreate.mockResolvedValue(SAMPLE_RESPONSE)

    await expect(createCheckoutPreference(input)).resolves.toEqual({
      id: 'pref-1',
      initPoint: SAMPLE_RESPONSE.sandbox_init_point,
    })
  })

  it('throws when the preference response is missing id or init point', async () => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = 'APP_USR-prod'
    mockPreferenceCreate.mockResolvedValue({ id: 'pref-1' })

    await expect(createCheckoutPreference(input)).rejects.toThrow('missing id or init_point')
  })

  it('propagates a Mercado Pago API rejection', async () => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = 'APP_USR-prod'
    mockPreferenceCreate.mockRejectedValueOnce(new Error('Mercado Pago API error'))

    await expect(createCheckoutPreference(input)).rejects.toThrow('Mercado Pago API error')
  })
})
