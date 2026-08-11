import type { PageServerLoad } from './$types'
import { getDb } from '$lib/server/db'
import { resolveCheckoutPrice } from '$lib/server/pricing'

export const prerender = false

export const load: PageServerLoad = async ({ url }) => {
  const slug = url.searchParams.get('product') ?? ''
  const db = await getDb().catch(() => undefined)
  if (!db || !slug) return { productSlug: slug, price: null }
  return { productSlug: slug, price: (await resolveCheckoutPrice(db, slug)) ?? null }
}
