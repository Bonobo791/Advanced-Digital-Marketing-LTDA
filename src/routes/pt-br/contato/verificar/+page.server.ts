import type { PageServerLoad } from './$types'
import { contactVerifyPageData } from '$lib/server/contact'

// The verify page reads a ?token= query param at request time — it can never
// be prerendered (the root layout prerenders everything else).
export const prerender = false

export const load: PageServerLoad = async ({ url }) => contactVerifyPageData(url)
