import type { PageServerLoad } from './$types'
import { contactVerifyPageData } from '$lib/server/contact'

// The verify page reads a ?token= query param at request time — it can never
// be prerendered (SSR, like everything else).
export const prerender = false

export const load: PageServerLoad = ({ url, setHeaders }) => {
  // The rendered state is token-specific and must never be cached by the CDN:
  // a cached notification_failed page would swallow the promised retry (the
  // next click has to reach verifyContactRequest again).
  setHeaders({ 'Cache-Control': 'private, no-store' })
  return contactVerifyPageData(url)
}
