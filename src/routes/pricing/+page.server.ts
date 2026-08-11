import type { PageServerLoad } from './$types'
import { getDb } from '$lib/server/db'
import { listActiveProductsWithPrice } from '$lib/server/pricing'

export const prerender = false

export const load: PageServerLoad = async () => {
  const db = await getDb().catch(() => undefined)
  if (!db) return { products: [] }
  return { products: await listActiveProductsWithPrice(db) }
}
