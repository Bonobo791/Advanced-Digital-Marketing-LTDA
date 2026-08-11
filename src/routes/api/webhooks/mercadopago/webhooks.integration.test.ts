import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './+server'
import { resetDbCache, getDb } from '$lib/server/db'
import { getMpPayment } from '$lib/server/mercadopago'
import { createOrder, getOrder, type CreateOrderInput } from '$lib/server/orders'

vi.mock('$lib/server/mercadopago', () => ({
  getMpPayment: vi.fn(),
}))

const mockGetPayment = vi.mocked(getMpPayment)

const SECRET = 'test-webhook-secret'

/** Replicates the SDK's signed-webhook manifest (id/request-id/ts, HMAC-SHA256). */
function sign(dataId: string, requestId: string, secret: string, ts: number): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
  const v1 = createHmac('sha256', secret).update(manifest).digest('hex')
  return `ts=${ts},v1=${v1}`
}

const webhookEvent = (overrides: {
  paymentId?: string
  signature?: string | null
  requestId?: string
  body?: unknown
} = {}) => {
  const paymentId = overrides.paymentId ?? '123456'
  const requestId = overrides.requestId ?? 'x-request-1'
  const ts = Math.floor(Date.now() / 1000)
  const signature =
    overrides.signature === undefined ? sign(paymentId, requestId, SECRET, ts) : overrides.signature
  const headers: Record<string, string> = { 'x-request-id': requestId }
  if (signature !== null) headers['x-signature'] = signature
  return {
    request: new Request(
      `http://localhost/api/webhooks/mercadopago?data.id=${paymentId}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(overrides.body ?? { type: 'payment', data: { id: paymentId } }),
      },
    ),
  } as Parameters<typeof POST>[0]
}

const orderInput: CreateOrderInput = {
  productId: 'seo',
  price: {
    priceId: 'price_seo_2026_08',
    productId: 'seo',
    productName: 'SEO & GEO',
    currency: 'BRL',
    amountCents: 390_000,
    subtotalCents: 390_000,
    discountCents: 0,
    totalCents: 390_000,
    promotionId: null,
  },
  customer: { name: 'Ada Lovelace', email: 'ada@example.com' },
}

describe('POST /api/webhooks/mercadopago', () => {
  beforeEach(() => {
    vi.stubEnv('TURSO_DATABASE_URL', ':memory:')
    vi.stubEnv('MERCADO_PAGO_WEBHOOK_SECRET', SECRET)
    resetDbCache()
    mockGetPayment.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('processes an unsigned notification when no webhook secret is configured', async () => {
    // Test credentials never include a webhook secret; the authenticated
    // payment re-fetch is the integrity check.
    vi.stubEnv('MERCADO_PAGO_WEBHOOK_SECRET', '')
    const db = await getDb()
    const order = await createOrder(db, orderInput)
    mockGetPayment.mockResolvedValue({
      id: '123456',
      status: 'approved',
      statusDetail: 'accredited',
      paymentMethodId: 'pix',
      externalReference: order.id,
    })

    const response = await POST(webhookEvent({ signature: null }))
    expect(response.status).toBe(200)
    expect((await getOrder(db, order.id))?.status).toBe('approved')
  })

  it('processes an unsigned notification even when a secret is configured', async () => {
    // Notifications delivered via the preference's notification_url are
    // unsigned; they must still be accepted and verified by re-fetching.
    const db = await getDb()
    const order = await createOrder(db, orderInput)
    mockGetPayment.mockResolvedValue({
      id: '123456',
      status: 'approved',
      statusDetail: 'accredited',
      paymentMethodId: 'pix',
      externalReference: order.id,
    })

    const response = await POST(webhookEvent({ signature: null }))
    expect(response.status).toBe(200)
    expect((await getOrder(db, order.id))?.status).toBe('approved')
  })

  it('rejects a notification with an invalid signature', async () => {
    const response = await POST(webhookEvent({ signature: 'ts=1,v1=deadbeef' }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'invalid_signature' })
  })

  it('rejects a forged signature with a valid timestamp', async () => {
    const ts = Math.floor(Date.now() / 1000)
    const forged = sign('123456', 'x-request-1', 'wrong-secret', ts)
    const response = await POST(webhookEvent({ signature: forged }))
    expect(response.status).toBe(401)
  })

  it('updates the order to approved and attaches the payment id (idempotent)', async () => {
    const db = await getDb()
    const order = await createOrder(db, orderInput)
    mockGetPayment.mockResolvedValue({
      id: '123456',
      status: 'approved',
      statusDetail: 'accredited',
      paymentMethodId: 'pix',
      externalReference: order.id,
    })

    const response = await POST(webhookEvent({ paymentId: '123456' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: true })

    const updated = await getOrder(db, order.id)
    expect(updated?.status).toBe('approved')
    expect(updated?.mpPaymentId).toBe('123456')
    expect(updated?.mpStatus).toBe('approved')
    expect(updated?.mpPaymentMethod).toBe('pix')

    // A duplicate delivery is a no-op, not an error.
    const duplicate = await POST(webhookEvent({ paymentId: '123456' }))
    expect(duplicate.status).toBe(200)
    expect((await getOrder(db, order.id))?.status).toBe('approved')
  })

  it('maps a rejected payment', async () => {
    const db = await getDb()
    const order = await createOrder(db, orderInput)
    mockGetPayment.mockResolvedValue({
      id: '123456',
      status: 'rejected',
      statusDetail: 'rejected_high_risk',
      paymentMethodId: 'visa',
      externalReference: order.id,
    })

    const response = await POST(webhookEvent())
    expect(response.status).toBe(200)
    expect((await getOrder(db, order.id))?.status).toBe('rejected')
  })

  it('maps a chargeback to refunded', async () => {
    const db = await getDb()
    const order = await createOrder(db, orderInput)
    await db.execute({
      sql: `UPDATE orders SET status = 'approved', updated_at = :now WHERE id = :id`,
      args: { id: order.id, now: new Date().toISOString() },
    })
    mockGetPayment.mockResolvedValue({
      id: '123456',
      status: 'charged_back',
      statusDetail: 'chargeback_settlement',
      paymentMethodId: 'pix',
      externalReference: order.id,
    })

    const response = await POST(webhookEvent())
    expect(response.status).toBe(200)
    expect((await getOrder(db, order.id))?.status).toBe('refunded')
  })

  it('ignores a notification whose payment is not the bound one', async () => {
    const db = await getDb()
    const order = await createOrder(db, orderInput)
    await db.execute({
      sql: `UPDATE orders SET mp_payment_id = '111111', status = 'pending', updated_at = :now WHERE id = :id`,
      args: { id: order.id, now: new Date().toISOString() },
    })
    mockGetPayment.mockResolvedValue({
      id: '222222',
      status: 'approved',
      statusDetail: 'accredited',
      paymentMethodId: 'pix',
      externalReference: order.id,
    })

    const response = await POST(webhookEvent({ paymentId: '222222' }))
    expect(response.status).toBe(200)
    const updated = await getOrder(db, order.id)
    expect(updated?.status).toBe('pending')
    expect(updated?.mpPaymentId).toBe('111111')
  })

  it('returns 404 when the payment cannot be fetched', async () => {
    mockGetPayment.mockResolvedValue(undefined)
    const response = await POST(webhookEvent())
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'payment_not_found' })
  })

  it('acknowledges notifications that are not ours', async () => {
    const db = await getDb()
    const order = await createOrder(db, orderInput)

    mockGetPayment.mockResolvedValue({
      id: '123456',
      status: 'approved',
      statusDetail: 'accredited',
      paymentMethodId: 'pix',
      externalReference: 'some-other-order',
    })
    const notOurs = await POST(webhookEvent())
    expect(notOurs.status).toBe(200)
    expect((await getOrder(db, order.id))?.status).toBe('created')

    mockGetPayment.mockResolvedValue({
      id: '123456',
      status: 'approved',
      statusDetail: 'accredited',
      paymentMethodId: 'pix',
      externalReference: null,
    })
    const noReference = await POST(webhookEvent())
    expect(noReference.status).toBe(200)
  })

  it('returns 503 when the database is not configured', async () => {
    mockGetPayment.mockResolvedValue({
      id: '123456',
      status: 'approved',
      statusDetail: 'accredited',
      paymentMethodId: 'pix',
      externalReference: 'whatever',
    })
    vi.stubEnv('TURSO_DATABASE_URL', '')
    resetDbCache()
    const response = await POST(webhookEvent())
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'database_not_configured' })
  })
})
