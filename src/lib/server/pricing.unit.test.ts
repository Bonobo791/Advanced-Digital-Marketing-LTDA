import { beforeEach, describe, expect, it } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { SCHEMA_SQL } from './schema.mjs'
import { SEED_SQL } from './seed.mjs'
import {
  getCurrentPrice,
  resolveCheckoutPrice,
  validatePromotion,
  type CheckoutPrice,
} from './pricing'

let db: Client

beforeEach(async () => {
  db = createClient({ url: ':memory:' })
  await db.executeMultiple(SCHEMA_SQL)
  await db.executeMultiple(SEED_SQL)
})

const now = new Date('2026-08-10T12:00:00.000Z')

describe('getCurrentPrice', () => {
  it('returns the seeded active one-time price', async () => {
    const price = await getCurrentPrice(db, 'google-ads-management', now)
    expect(price).toBeDefined()
    expect(price?.amountCents).toBe(250_000)
    expect(price?.currency).toBe('BRL')
    expect(price?.billingType).toBe('one_time')
    expect(price?.interval).toBeNull()
    expect(price?.active).toBe(true)
  })

  it('returns undefined for unknown products', async () => {
    expect(await getCurrentPrice(db, 'not-a-product', now)).toBeUndefined()
  })

  it('is append-only: a new price supersedes the old one', async () => {
    await db.execute({
      sql: `
        UPDATE prices
        SET active = 0, effective_until = :until
        WHERE id = 'price_google_ads_2026_08'
      `,
      args: { until: '2026-07-31T00:00:00.000Z' },
    })
    await db.execute({
      sql: `
        INSERT INTO prices (id, product_id, currency, amount_cents, billing_type, interval, active, effective_from, effective_until, created_at)
        VALUES (:id, 'google-ads-management', 'BRL', :amount, 'one_time', NULL, 1, :from, NULL, :created)
      `,
      args: {
        id: 'price_google_ads_2026_09',
        amount: 300_000,
        from: '2026-08-01T00:00:00.000Z',
        created: '2026-07-15T00:00:00.000Z',
      },
    })

    const current = await getCurrentPrice(db, 'google-ads-management', now)
    expect(current?.id).toBe('price_google_ads_2026_09')
    expect(current?.amountCents).toBe(300_000)

    // The old row is never mutated — append-only.
    const oldRow = await db.execute({
      sql: 'SELECT amount_cents AS amountCents, active FROM prices WHERE id = :id',
      args: { id: 'price_google_ads_2026_08' },
    })
    const old = oldRow.rows?.[0] as unknown as { amountCents: number; active: number }
    expect(old.amountCents).toBe(250_000)
    expect(old.active).toBe(0)
  })
})

describe('resolveCheckoutPrice', () => {
  it('resolves the active price with no discount', async () => {
    const resolved = await resolveCheckoutPrice(db, 'seo', undefined, now)
    expect(resolved).toEqual<CheckoutPrice>({
      priceId: 'price_seo_2026_08',
      productId: 'seo',
      productName: 'SEO & GEO',
      currency: 'BRL',
      amountCents: 390_000,
      subtotalCents: 390_000,
      discountCents: 0,
      totalCents: 390_000,
      promotionId: null,
    })
  })

  it('returns undefined for unknown or unpriced products', async () => {
    expect(await resolveCheckoutPrice(db, 'not-a-product', undefined, now)).toBeUndefined()
    await db.execute({
      sql: 'UPDATE prices SET active = 0 WHERE id = :id',
      args: { id: 'price_consulting_2026_08' },
    })
    expect(await resolveCheckoutPrice(db, 'consulting', undefined, now)).toBeUndefined()
  })

  it('applies a percentage promotion', async () => {
    await db.execute({
      sql: `
        INSERT INTO price_adjustments (id, code, type, value, starts_at, expires_at, max_uses, active, created_at)
        VALUES (:id, :code, 'percentage', 10, NULL, NULL, NULL, 1, :created)
      `,
      args: { id: 'promo_10', code: 'LAUNCH10', created: now.toISOString() },
    })

    const resolved = await resolveCheckoutPrice(db, 'seo', 'LAUNCH10', now)
    expect(resolved?.discountCents).toBe(39_000)
    expect(resolved?.totalCents).toBe(351_000)
    expect(resolved?.promotionId).toBe('promo_10')
  })

  it('applies a fixed promotion and clamps at the subtotal', async () => {
    await db.execute({
      sql: `
        INSERT INTO price_adjustments (id, code, type, value, starts_at, expires_at, max_uses, active, created_at)
        VALUES (:id, :code, 'fixed', 999999, NULL, NULL, NULL, 1, :created)
      `,
      args: { id: 'promo_fixed', code: 'FREE', created: now.toISOString() },
    })

    const resolved = await resolveCheckoutPrice(db, 'consulting', 'FREE', now)
    expect(resolved?.discountCents).toBe(150_000)
    expect(resolved?.totalCents).toBe(0)
  })

  it('refuses unknown, inactive or out-of-window promotion codes', async () => {
    await db.execute({
      sql: `
        INSERT INTO price_adjustments (id, code, type, value, starts_at, expires_at, max_uses, active, created_at)
        VALUES (:id1, :code1, 'percentage', 10, :starts, :expires, NULL, 1, :created),
               (:id2, :code2, 'percentage', 10, NULL, NULL, NULL, 0, :created)
      `,
      args: {
        id1: 'promo_window',
        code1: 'WINDOW',
        starts: '2026-09-01T00:00:00.000Z',
        expires: '2026-09-30T00:00:00.000Z',
        id2: 'promo_inactive',
        code2: 'INACTIVE',
        created: now.toISOString(),
      },
    })

    expect(await resolveCheckoutPrice(db, 'seo', 'NOPE', now)).toBeUndefined()
    expect(await resolveCheckoutPrice(db, 'seo', 'WINDOW', now)).toBeUndefined()
    expect(await resolveCheckoutPrice(db, 'seo', 'INACTIVE', now)).toBeUndefined()
  })
})

describe('validatePromotion', () => {
  it('respects the active + schedule window', async () => {
    await db.execute({
      sql: `
        INSERT INTO price_adjustments (id, code, type, value, starts_at, expires_at, max_uses, active, created_at)
        VALUES (:id, :code, 'fixed', 5000, :starts, :expires, 10, 1, :created)
      `,
      args: {
        id: 'promo_aug',
        code: 'AUGUST',
        starts: '2026-08-01T00:00:00.000Z',
        expires: '2026-08-31T23:59:59.000Z',
        created: now.toISOString(),
      },
    })

    expect((await validatePromotion(db, 'AUGUST', now))?.type).toBe('fixed')
    expect((await validatePromotion(db, 'AUGUST', new Date('2026-09-01T00:00:00.000Z')))?.id).toBeUndefined()
    expect(await validatePromotion(db, 'MISSING', now)).toBeUndefined()
  })
})
