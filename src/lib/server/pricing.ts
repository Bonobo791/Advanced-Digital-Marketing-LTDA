/**
 * Versioned, append-only pricing.
 *
 * A price change NEVER updates an existing `prices` row: the old row is
 * deactivated (active = 0, effective_until set) and a new row is inserted.
 * `getCurrentPrice()` returns the single active price whose effective window
 * contains "now".
 *
 * Promotions (`price_adjustments`) are supported structurally but not yet
 * exposed anywhere in the UI.
 */
import { listActiveProducts } from './products'
import type { SqlDb } from './sql'

export const CURRENCY = 'BRL'

export interface PriceRecord {
  id: string
  productId: string
  currency: string
  amountCents: number
  billingType: 'one_time' | 'recurring'
  interval: 'month' | 'year' | null
  active: boolean
  effectiveFrom: string
  effectiveUntil: string | null
  createdAt: string
}

export interface PriceAdjustment {
  id: string
  code: string
  type: 'percentage' | 'fixed'
  value: number
  startsAt: string | null
  expiresAt: string | null
  maxUses: number | null
  active: boolean
}

interface PriceRowShape {
  id: string
  productId: string
  currency: string
  amountCents: number
  billingType: string
  interval: string | null
  active: number
  effectiveFrom: string
  effectiveUntil: string | null
  createdAt: string
}

function toPriceRecord(row: PriceRowShape): PriceRecord {
  const billingType = row.billingType === 'recurring' ? 'recurring' : 'one_time'
  const interval = row.interval === 'month' || row.interval === 'year' ? row.interval : null
  return {
    id: row.id,
    productId: row.productId,
    currency: row.currency,
    amountCents: Number(row.amountCents),
    billingType,
    interval,
    active: row.active === 1,
    effectiveFrom: row.effectiveFrom,
    effectiveUntil: row.effectiveUntil,
    createdAt: row.createdAt,
  }
}

/**
 * The currently active price for a product: active row whose effective window
 * contains `now`, newest `effective_from` wins.
 */
export async function getCurrentPrice(
  db: SqlDb,
  productId: string,
  now: Date = new Date(),
): Promise<PriceRecord | undefined> {
  const nowIso = now.toISOString()
  const result = await db.execute({
    sql: `
      SELECT id, product_id AS productId, currency, amount_cents AS amountCents,
             billing_type AS billingType, interval, active,
             effective_from AS effectiveFrom, effective_until AS effectiveUntil,
             created_at AS createdAt
      FROM prices
      WHERE product_id = :productId AND active = 1
        AND effective_from <= :nowIso
        AND (effective_until IS NULL OR effective_until >= :nowIso)
      ORDER BY effective_from DESC, created_at DESC
      LIMIT 1
    `,
    args: { productId, nowIso },
  })
  const rows = result.rows ?? []
  if (rows.length === 0) return undefined
  return toPriceRecord(rows[0] as unknown as PriceRowShape)
}

/**
 * Validates a promotion code against its active + schedule windows.
 * `max_uses` is stored but not enforced yet (usage tracking is a later step).
 */
export async function validatePromotion(
  db: SqlDb,
  code: string,
  now: Date = new Date(),
): Promise<PriceAdjustment | undefined> {
  const nowIso = now.toISOString()
  const result = await db.execute({
    sql: `
      SELECT id, code, type, value, starts_at AS startsAt, expires_at AS expiresAt,
             max_uses AS maxUses, active
      FROM price_adjustments
      WHERE code = :code AND active = 1
        AND (starts_at IS NULL OR starts_at <= :nowIso)
        AND (expires_at IS NULL OR expires_at >= :nowIso)
      LIMIT 1
    `,
    args: { code, nowIso },
  })
  const rows = result.rows ?? []
  if (rows.length === 0) return undefined
  const row = rows[0] as unknown as {
    id: string
    code: string
    type: string
    value: number
    startsAt: string | null
    expiresAt: string | null
    maxUses: number | null
    active: number
  }
  return {
    id: row.id,
    code: row.code,
    type: row.type === 'fixed' ? 'fixed' : 'percentage',
    value: Number(row.value),
    startsAt: row.startsAt,
    expiresAt: row.expiresAt,
    maxUses: row.maxUses === null ? null : Number(row.maxUses),
    active: row.active === 1,
  }
}

/** A product with its currently active price (for the /pricing page). */
export interface PricedProduct {
  slug: string
  name: string
  description: string
  price: PriceRecord
}

/** All active products that currently have an active price. */
export async function listActiveProductsWithPrice(
  db: SqlDb,
  now: Date = new Date(),
): Promise<PricedProduct[]> {
  const products = await listActiveProducts(db)
  const priced: PricedProduct[] = []
  for (const product of products) {
    const price = await getCurrentPrice(db, product.id, now)
    if (price) priced.push({ slug: product.slug, name: product.name, description: product.description, price })
  }
  return priced
}
