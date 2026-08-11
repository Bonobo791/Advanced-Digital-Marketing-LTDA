/**
 * Product lookup — reads active products from Turso (the source of truth).
 *
 * The slug set below is the typed set of seeded product slugs; names,
 * descriptions and prices live in the database (`products` / `prices`).
 */
import type { SqlDb } from './sql'

export interface ProductRecord {
  id: string
  slug: string
  name: string
  description: string
  active: boolean
}

export const PRODUCT_SLUGS = [
  'google-ads-management',
  'meta-ads-management',
  'seo',
  'website-development',
  'consulting',
] as const

export type ProductId = (typeof PRODUCT_SLUGS)[number]

export function isProductId(slug: string): slug is ProductId {
  return (PRODUCT_SLUGS as readonly string[]).includes(slug)
}

interface ProductRowShape {
  id: string
  slug: string
  name: string
  description: string
  active: number
}

function toProduct(row: ProductRowShape): ProductRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    active: row.active === 1,
  }
}

function firstProduct(rows: ReadonlyArray<Record<string, unknown>> | undefined): ProductRecord | undefined {
  if (!rows || rows.length === 0) return undefined
  return toProduct(rows[0] as unknown as ProductRowShape)
}

/** Returns the active product for a slug, or undefined when unknown/inactive. */
export async function getActiveProduct(db: SqlDb, slug: string): Promise<ProductRecord | undefined> {
  const result = await db.execute({
    sql: 'SELECT id, slug, name, description, active FROM products WHERE slug = :slug AND active = 1 LIMIT 1',
    args: { slug },
  })
  return firstProduct(result.rows)
}

/** All active products, ordered by name (for /pricing and admin tooling). */
export async function listActiveProducts(db: SqlDb): Promise<ProductRecord[]> {
  const result = await db.execute({
    sql: 'SELECT id, slug, name, description, active FROM products WHERE active = 1 ORDER BY name',
  })
  return (result.rows ?? []).map((row) => toProduct(row as unknown as ProductRowShape))
}
