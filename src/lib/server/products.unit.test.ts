import { beforeEach, describe, expect, it } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { SCHEMA_SQL } from './schema.mjs'
import { SEED_SQL } from './seed.mjs'
import { getActiveProduct, isProductId, listActiveProducts, PRODUCT_SLUGS } from './products'

let db: Client

beforeEach(async () => {
  db = createClient({ url: ':memory:' })
  await db.executeMultiple(SCHEMA_SQL)
  await db.executeMultiple(SEED_SQL)
})

describe('product lookup (DB-backed)', () => {
  it('defines the five seeded product slugs', () => {
    expect(PRODUCT_SLUGS).toHaveLength(5)
    expect(PRODUCT_SLUGS).toEqual([
      'google-ads-management',
      'meta-ads-management',
      'seo',
      'website-development',
      'consulting',
    ])
    expect(isProductId('seo')).toBe(true)
    expect(isProductId('not-a-product')).toBe(false)
  })

  it('lists all active seeded products', async () => {
    const products = await listActiveProducts(db)
    expect(products).toHaveLength(5)
    const slugs = products.map((product) => product.slug)
    expect(new Set(slugs).size).toBe(5)
    for (const product of products) {
      expect(product.active).toBe(true)
      expect(product.name.length).toBeGreaterThan(0)
    }
  })

  it('returns the active product for a slug', async () => {
    const seo = await getActiveProduct(db, 'seo')
    expect(seo?.name).toBe('SEO & GEO')
    expect(seo?.id).toBe('seo')
    expect(await getActiveProduct(db, 'not-a-product')).toBeUndefined()
  })

  it('hides inactive products', async () => {
    await db.execute({
      sql: 'UPDATE products SET active = 0 WHERE slug = :slug',
      args: { slug: 'consulting' },
    })
    expect(await getActiveProduct(db, 'consulting')).toBeUndefined()
    expect(await listActiveProducts(db)).toHaveLength(4)
  })
})
