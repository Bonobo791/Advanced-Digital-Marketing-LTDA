import { beforeEach, describe, expect, it } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { SCHEMA_SQL } from './schema.mjs'
import { SEED_SQL } from './seed.mjs'
import {
  attachMpPayment,
  createOrder,
  getOrder,
  getOrderByPaymentId,
  mapMpStatusToOrderStatus,
  updateOrderStatus,
  type CreateOrderInput,
} from './orders'

let db: Client

beforeEach(async () => {
  db = createClient({ url: ':memory:' })
  await db.executeMultiple(SCHEMA_SQL)
  await db.executeMultiple(SEED_SQL)
})

const input: CreateOrderInput = {
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
  customer: {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    company: 'Analytical Engines',
    documentType: 'CPF',
    document: '529.982.247-25',
  },
  attribution: {
    utmSource: 'google',
    utmCampaign: 'summer',
    gclid: 'abc',
    landingPage: '/pricing',
    referrer: 'https://google.com',
  },
}

describe('orders repository', () => {
  it('creates and reads back an order with a price snapshot and attribution', async () => {
    const order = await createOrder(db, input)

    expect(order.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(order.productId).toBe('seo')
    expect(order.status).toBe('created')
    expect(order.transactionId).toBe(order.id)
    expect(order.priceId).toBe('price_seo_2026_08')
    expect(order.productName).toBe('SEO & GEO')
    expect(order.currency).toBe('BRL')
    expect(order.amountCents).toBe(390_000)
    expect(order.subtotalCents).toBe(390_000)
    expect(order.discountCents).toBe(0)
    expect(order.totalCents).toBe(390_000)
    expect(order.promotionId).toBeNull()
    expect(order.customerName).toBe('Ada Lovelace')
    expect(order.customerDocumentType).toBe('CPF')
    expect(order.attribution).toEqual(input.attribution)
    expect(order.createdAt).toBe(order.updatedAt)

    const fetched = await getOrder(db, order.id)
    expect(fetched).toEqual(order)
    expect(await getOrder(db, 'missing')).toBeUndefined()
  })

  it('persists a discounted snapshot exactly as resolved', async () => {
    const order = await createOrder(db, {
      ...input,
      price: {
        ...input.price,
        amountCents: 250_000,
        subtotalCents: 250_000,
        discountCents: 25_000,
        totalCents: 225_000,
        promotionId: 'promo_10',
      },
    })

    expect(order.amountCents).toBe(250_000)
    expect(order.discountCents).toBe(25_000)
    expect(order.totalCents).toBe(225_000)
    expect(order.promotionId).toBe('promo_10')
    const fetched = await getOrder(db, order.id)
    expect(fetched?.totalCents).toBe(225_000)
    expect(fetched?.promotionId).toBe('promo_10')
  })

  it('looks up an order by Mercado Pago payment id', async () => {
    const order = await createOrder(db, input)
    await attachMpPayment(db, order.id, 'mp-123')

    expect((await getOrderByPaymentId(db, 'mp-123'))?.id).toBe(order.id)
    expect(await getOrderByPaymentId(db, 'mp-999')).toBeUndefined()
  })

  it('only attaches the first Mercado Pago payment id', async () => {
    const order = await createOrder(db, input)

    const first = await attachMpPayment(db, order.id, 'mp-1')
    expect(first.ok).toBe(true)
    expect(first.order?.mpPaymentId).toBe('mp-1')

    const second = await attachMpPayment(db, order.id, 'mp-2')
    expect(second.ok).toBe(false)
    expect(second.order?.mpPaymentId).toBe('mp-1')
  })

  it('walks the happy-path status transitions', async () => {
    const order = await createOrder(db, input)

    const pending = await updateOrderStatus(db, order.id, 'pending', {
      mpStatus: 'pending',
      mpStatusDetail: 'pending_waiting_transfer',
      mpPaymentMethod: 'pix',
    })
    expect(pending.ok && pending.order.status).toBe('pending')

    const approved = await updateOrderStatus(db, order.id, 'approved', {
      mpStatus: 'approved',
      mpStatusDetail: 'accredited',
      mpPaymentMethod: 'pix',
    })
    expect(approved.ok && approved.order.status).toBe('approved')
    expect(approved.ok && approved.order.mpStatus).toBe('approved')

    const refunded = await updateOrderStatus(db, order.id, 'refunded')
    expect(refunded.ok && refunded.order.status).toBe('refunded')
  })

  it('lets an approved order move back to pending during in_mediation only', async () => {
    const order = await createOrder(db, input)
    await updateOrderStatus(db, order.id, 'pending')
    await updateOrderStatus(db, order.id, 'approved')

    // A plain `pending` notification never regresses an approved order.
    const plainPending = await updateOrderStatus(db, order.id, 'pending', {
      mpStatus: 'pending',
    })
    expect(plainPending.ok).toBe(false)
    if (!plainPending.ok) {
      expect(plainPending.reason).toBe('invalid_transition')
      expect(plainPending.order?.status).toBe('approved')
    }

    // Only in_mediation may hold an approved order as pending.
    const mediation = await updateOrderStatus(db, order.id, 'pending', {
      mpStatus: 'in_mediation',
      mpStatusDetail: 'in_mediation',
    })
    expect(mediation.ok && mediation.order.status).toBe('pending')
    expect(mediation.ok && mediation.order.mpStatus).toBe('in_mediation')
  })

  it('is idempotent for duplicate webhook status updates', async () => {
    const order = await createOrder(db, input)
    await updateOrderStatus(db, order.id, 'pending')
    const duplicate = await updateOrderStatus(db, order.id, 'pending')
    expect(duplicate.ok).toBe(true)
  })

  it('rejects invalid transitions', async () => {
    const order = await createOrder(db, input)
    const result = await updateOrderStatus(db, order.id, 'refunded')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('invalid_transition')
      expect(result.order?.status).toBe('created')
    }

    await updateOrderStatus(db, order.id, 'pending')
    const refundEarly = await updateOrderStatus(db, order.id, 'refunded')
    expect(refundEarly.ok).toBe(false)
    if (!refundEarly.ok) expect(refundEarly.reason).toBe('invalid_transition')
  })

  it('reports not_found for unknown orders', async () => {
    const result = await updateOrderStatus(db, 'missing', 'pending')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('not_found')
  })

  it('maps Mercado Pago statuses to order statuses', () => {
    expect(mapMpStatusToOrderStatus('approved')).toBe('approved')
    expect(mapMpStatusToOrderStatus('pending')).toBe('pending')
    expect(mapMpStatusToOrderStatus('in_process')).toBe('pending')
    expect(mapMpStatusToOrderStatus('rejected')).toBe('rejected')
    expect(mapMpStatusToOrderStatus('cancelled')).toBe('rejected')
    expect(mapMpStatusToOrderStatus('in_mediation')).toBe('pending')
    expect(mapMpStatusToOrderStatus('charged_back')).toBe('refunded')
    expect(mapMpStatusToOrderStatus('refunded')).toBe('refunded')
    expect(mapMpStatusToOrderStatus('weird_status')).toBeUndefined()
  })
})
