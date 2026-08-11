import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import { getOrder } from '$lib/server/orders'

export const prerender = false
export const trailingSlash = 'ignore'

/**
 * GET /api/orders/[id]
 *
 * Public-safe order lookup for the result pages. Only ever reflects what the
 * DATABASE says — landing on /checkout/success is not proof of payment.
 * Deliberately excludes customer PII and payment details.
 */
export const GET: RequestHandler = async ({ params }) => {
  const db = await getDb().catch(() => undefined)
  if (!db) return json({ error: 'database_not_configured' }, { status: 503 })

  const order = await getOrder(db, params.id)
  if (!order) return json({ error: 'order_not_found' }, { status: 404 })

  return json({
    id: order.id,
    productId: order.productId,
    productName: order.productName,
    currency: order.currency,
    amountCents: order.totalCents,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  })
}
