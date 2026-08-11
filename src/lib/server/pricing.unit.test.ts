import { beforeEach, describe, expect, it } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { SCHEMA_SQL } from './schema.mjs'
import { SEED_SQL } from './seed.mjs'
import { getCurrentPrice, listActiveProductsWithPrice, validatePromotion } from './pricing'

let db: Client

beforeEach(async () => {
  db = createClient({ url: ':memory:' })
  await db.executeMultiple(SCHEMA_SQL)
  await db.executeMultiple(SEED_SQL)
})

const now = new Date('2026-08-10T12:00:00.000Z')

describe('getCurrentPrice', () => {
  it('returns the seeded active one-time prices', async () => {
    const consulting = await getCurrentPrice(db, 'consulting', now)
    expect(consulting?.id).toBe('price_consulting_2026_08')
    expect(consulting?.amountCents).toBe(150_000)
    expect(consulting?.currency).toBe('BRL')
    expect(consulting?.billingType).toBe('one_time')
    expect(consulting?.interval).toBeNull()
    expect(consulting?.active).toBe(true)

    const seo = await getCurrentPrice(db, 'seo', now)
    expect(seo?.amountCents).toBe(390_000)
    expect(seo?.billingType).toBe('one_time')
  })

  it('returns undefined for unknown products', async () => {
    expect(await getCurrentPrice(db, 'not-a-product', now)).toBeUndefined()
  })

  it('is append-only: a new price supersedes the old one', async () => {
    await db.execute({
      sql: `
        UPDATE prices
        SET active = 0, effective_until = :until
        WHERE id = 'price_consulting_2026_08'
      `,
      args: { until: '2026-07-31T00:00:00.000Z' },
    })
    await db.execute({
      sql: `
        INSERT INTO prices (id, product_id, currency, amount_cents, billing_type, interval, active, effective_from, effective_until, created_at)
        VALUES (:id, 'consulting', 'BRL', :amount, 'one_time', NULL, 1, :from, NULL, :created)
      `,
      args: {
        id: 'price_consulting_2026_09',
        amount: 200_000,
        from: '2026-08-01T00:00:00.000Z',
        created: '2026-07-15T00:00:00.000Z',
      },
    })

    const current = await getCurrentPrice(db, 'consulting', now)
    expect(current?.id).toBe('price_consulting_2026_09')
    expect(current?.amountCents).toBe(200_000)

    // The old row is never mutated — append-only.
    const oldRow = await db.execute({
      sql: 'SELECT amount_cents AS amountCents, active FROM prices WHERE id = :id',
      args: { id: 'price_consulting_2026_08' },
    })
    const old = oldRow.rows?.[0] as unknown as { amountCents: number; active: number }
    expect(old.amountCents).toBe(150_000)
    expect(old.active).toBe(0)
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

describe('listActiveProductsWithPrice', () => {
  it('returns every active product with its current price', async () => {
    const products = await listActiveProductsWithPrice(db, now)
    expect(products).toHaveLength(5)
    for (const product of products) {
      expect(product.price.active).toBe(true)
      expect(product.price.amountCents).toBeGreaterThan(0)
    }
    const bySlug = new Map(products.map((product) => [product.slug, product]))
    expect(bySlug.get('consulting')?.price.amountCents).toBe(150_000)
    expect(bySlug.get('seo')?.price.amountCents).toBe(390_000)
  })

  it('omits products without a current active price', async () => {
    await db.execute({
      sql: 'UPDATE prices SET active = 0 WHERE id = :id',
      args: { id: 'price_consulting_2026_08' },
    })
    const products = await listActiveProductsWithPrice(db, now)
    expect(products.map((product) => product.slug)).not.toContain('consulting')
    expect(products).toHaveLength(4)
  })
})
