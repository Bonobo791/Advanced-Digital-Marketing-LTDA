import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './+server'
import { resetDbCache } from '$lib/server/db'
import { createCheckoutPreference } from '$lib/server/mercadopago'
import { getOrder } from '$lib/server/orders'

vi.mock('$lib/server/mercadopago', () => ({
  createCheckoutPreference: vi.fn(),
}))

const mockCreatePreference = vi.mocked(createCheckoutPreference)

const requestEvent = (body: unknown) =>
  ({
    request: new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  }) as Parameters<typeof POST>[0]

const validBody = {
  productId: 'seo',
  customer: {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    company: 'Analytical Engines',
    documentType: 'CPF',
    document: '529.982.247-25',
  },
}

describe('POST /api/checkout', () => {
  beforeEach(() => {
    vi.stubEnv('TURSO_DATABASE_URL', ':memory:')
    resetDbCache()
    mockCreatePreference.mockReset()
    mockCreatePreference.mockResolvedValue({
      id: 'pref-1',
      initPoint: 'https://sandbox.mercadopago.com.br/checkout/v1/pref-1',
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects an unknown product without calling Mercado Pago', async () => {
    const response = await POST(requestEvent({ ...validBody, productId: 'not-a-product' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'unknown_product' })
    expect(mockCreatePreference).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON', async () => {
    const response = await POST(
      ({ request: new Request('http://localhost/api/checkout', { method: 'POST', body: '{' }) }) as Parameters<typeof POST>[0],
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid_json' })
  })

  it('validates customer fields server-side', async () => {
    const badEmail = await POST(
      requestEvent({ ...validBody, customer: { ...validBody.customer, email: 'nope' } }),
    )
    expect(badEmail.status).toBe(400)
    expect(await badEmail.json()).toEqual({ error: 'invalid_email' })

    const badDocument = await POST(
      requestEvent({
        ...validBody,
        customer: { ...validBody.customer, document: '111.111.111-11' },
      }),
    )
    expect(badDocument.status).toBe(400)
    expect(await badDocument.json()).toEqual({ error: 'invalid_document' })

    const documentWithoutType = await POST(
      requestEvent({
        ...validBody,
        customer: {
          name: 'Ada',
          email: 'ada@example.com',
          document: '529.982.247-25',
        },
      }),
    )
    expect(documentWithoutType.status).toBe(400)
    expect(await documentWithoutType.json()).toEqual({ error: 'invalid_document' })
  })

  it('creates an order and a preference with the server-resolved price', async () => {
    const response = await POST(requestEvent(validBody))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.orderId).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.initPoint).toBe('https://sandbox.mercadopago.com.br/checkout/v1/pref-1')

    // The order row snapshots the seeded SEO price (R$ 3.900).
    const order = await getOrder(
      await (await import('$lib/server/db')).getDb(),
      body.orderId as string,
    )
    expect(order?.productName).toBe('SEO & GEO')
    expect(order?.priceId).toBe('price_seo_2026_08')
    expect(order?.amountCents).toBe(390_000)
    expect(order?.totalCents).toBe(390_000)
    expect(order?.currency).toBe('BRL')
    expect(order?.status).toBe('created')

    // The preference is built from the snapshot, keyed by our order id.
    expect(mockCreatePreference).toHaveBeenCalledTimes(1)
    const call = mockCreatePreference.mock.calls[0][0]
    expect(call.externalReference).toBe(body.orderId)
    expect(call.unitPriceCents).toBe(390_000)
    expect(call.title).toBe('SEO & GEO')
    expect(call.backUrls.success).toBe(
      `http://localhost/checkout/success?order_id=${body.orderId}`,
    )
    expect(call.backUrls.pending).toContain('/checkout/pending?order_id=')
    expect(call.backUrls.failure).toContain('/checkout/failure?order_id=')
    expect(call.notificationUrl).toBe('http://localhost/api/webhooks/mercadopago')
    expect(call.payerEmail).toBe('ada@example.com')
  })

  it('marks the order rejected and returns 502 when the preference creation fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mockCreatePreference.mockRejectedValueOnce(new Error('Mercado Pago unavailable'))

      const response = await POST(requestEvent(validBody))
      expect(response.status).toBe(502)
      expect(await response.json()).toEqual({ error: 'payment_creation_failed' })
      expect(errorSpy).toHaveBeenCalled()

      // The order attempt is terminal — never left orphaned as 'created'.
      const db = await (await import('$lib/server/db')).getDb()
      const rows = await db.execute({ sql: 'SELECT id, status FROM orders', args: {} })
      expect(rows.rows).toHaveLength(1)
      const row = rows.rows[0] as unknown as { id: string; status: string }
      expect(row.status).toBe('rejected')
      expect((await getOrder(db, row.id))?.status).toBe('rejected')
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('builds pt-BR back_urls when the customer locale is pt-BR', async () => {
    const response = await POST(requestEvent({ ...validBody, locale: 'pt-BR' }))
    expect(response.status).toBe(200)
    const body = await response.json()

    const call = mockCreatePreference.mock.calls[0][0]
    expect(call.backUrls.success).toBe(
      `http://localhost/pt-br/checkout/success?order_id=${body.orderId}`,
    )
    expect(call.backUrls.pending).toContain('/pt-br/checkout/pending?order_id=')
    expect(call.backUrls.failure).toContain('/pt-br/checkout/failure?order_id=')
  })

  it('applies a valid promotion code server-side', async () => {
    const db = await (await import('$lib/server/db')).getDb()
    await db.execute({
      sql: `
        INSERT INTO price_adjustments (id, code, type, value, starts_at, expires_at, max_uses, active, created_at)
        VALUES (:id, :code, 'percentage', 10, NULL, NULL, NULL, 1, :created)
      `,
      args: { id: 'promo_10', code: 'LAUNCH10', created: new Date().toISOString() },
    })

    const response = await POST(
      requestEvent({ ...validBody, promotionCode: 'LAUNCH10' }),
    )
    expect(response.status).toBe(200)
    const body = await response.json()

    const order = await getOrder(db, body.orderId as string)
    expect(order?.discountCents).toBe(39_000)
    expect(order?.totalCents).toBe(351_000)
    expect(order?.promotionId).toBe('promo_10')
    expect(mockCreatePreference.mock.calls[0][0].unitPriceCents).toBe(351_000)
  })

  it('refuses an invalid promotion code', async () => {
    const response = await POST(requestEvent({ ...validBody, promotionCode: 'NOPE' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'product_not_available' })
  })

  it('rejects checkout when the product price is inactive', async () => {
    const db = await (await import('$lib/server/db')).getDb()
    await db.execute({
      sql: 'UPDATE prices SET active = 0 WHERE id = :id',
      args: { id: 'price_seo_2026_08' },
    })

    const response = await POST(requestEvent(validBody))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'product_not_available' })
    expect(mockCreatePreference).not.toHaveBeenCalled()
  })

  it('returns 503 when Mercado Pago is not configured', async () => {
    mockCreatePreference.mockResolvedValue(undefined)
    const response = await POST(requestEvent(validBody))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'payment_not_configured' })
  })

  it('returns 503 when the database is not configured', async () => {
    vi.stubEnv('TURSO_DATABASE_URL', '')
    resetDbCache()
    const response = await POST(requestEvent(validBody))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'database_not_configured' })
  })
})
