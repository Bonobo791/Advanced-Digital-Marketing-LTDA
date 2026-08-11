import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './+server'
import { getDb, resetDbCache } from '$lib/server/db'
import { createOrder, type CreateOrderInput } from '$lib/server/orders'

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

const event = (id: string) =>
  ({ params: { id } }) as Parameters<typeof GET>[0]

describe('GET /api/orders/[id]', () => {
  beforeEach(() => {
    vi.stubEnv('TURSO_DATABASE_URL', ':memory:')
    resetDbCache()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns the public order shape', async () => {
    const db = await getDb()
    const order = await createOrder(db, orderInput)

    const response = await GET(event(order.id))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      id: order.id,
      productId: 'seo',
      productName: 'SEO & GEO',
      currency: 'BRL',
      amountCents: 390_000,
      status: 'created',
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    })
  })

  it('reflects webhook-driven status changes', async () => {
    const db = await getDb()
    const order = await createOrder(db, orderInput)
    await db.execute({
      sql: `UPDATE orders SET status = 'approved', updated_at = :now WHERE id = :id`,
      args: { id: order.id, now: new Date().toISOString() },
    })

    const response = await GET(event(order.id))
    expect((await response.json()).status).toBe('approved')
  })

  it('returns 404 for an unknown order', async () => {
    const response = await GET(event('missing-order'))
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'order_not_found' })
  })

  it('returns 503 when the database is not configured', async () => {
    vi.stubEnv('TURSO_DATABASE_URL', '')
    resetDbCache()
    const response = await GET(event('any'))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'database_not_configured' })
  })
})
