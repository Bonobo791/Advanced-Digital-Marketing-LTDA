import type { PageServerLoad } from './$types'
import { verifyContactRequest } from '$lib/server/contact'

// The verify page reads a ?token= query param at request time — it can never
// be prerendered (the root layout prerenders everything else).
export const prerender = false

export const load: PageServerLoad = async ({ url }) => {
  const token = url.searchParams.get('token') ?? ''
  return { verify: await verifyContactRequest(token) }
}
