import type { PageServerLoad } from './$types'
import { isValidPreapprovalId } from '$lib/server/checkout'
import { MercadoPagoError, getSubscription } from '$lib/server/mercadoPago'
import { ClientAddressError, clientIpAddress } from '$lib/server/client-ip'
import { checkRateLimit, rateLimitKey } from '$lib/server/rate-limit'

// The return page must verify the redirect server-side (it reads the
// preapproval_id query param), so it cannot be prerendered.
export const prerender = false

export type CompletionState =
  | { state: 'missing' }
  | { state: 'confirmed'; subscriptionId: string }
  | { state: 'pending'; subscriptionId: string }
  | { state: 'rate_limited' }
  | { state: 'error' }

/**
 * Verifies the subscription the customer was redirected from before claiming
 * success. Mercado Pago's hosted checkout appends `preapproval_id` to the
 * back_url; the page only reports "processada" when the preapproval status is
 * `authorized` (verified live against the API). Anything else renders a
 * pending/error state instead of an unconditional success claim.
 *
 * Abuse protection runs before the outbound call: this page is unauthenticated
 * and every request carrying a well-formed `preapproval_id` triggers a paid
 * Mercado Pago API call, so requests are throttled per client IP with the same
 * limiter used by subscription creation. The shape check runs first so
 * malformed identifiers are rejected without touching the API or consuming
 * rate-limit budget.
 */
export const load: PageServerLoad = async ({ url, getClientAddress }): Promise<CompletionState> => {
  const preapprovalId = url.searchParams.get('preapproval_id')
  if (!preapprovalId) return { state: 'missing' }

  // Cheap shape check first (no outbound call): malformed identifiers are
  // rejected without consuming rate-limit budget, so a scripted flood of junk
  // cannot exhaust the bucket that guards the paid API call below. Same
  // validate-then-throttle ordering as the subscription endpoint.
  if (!isValidPreapprovalId(preapprovalId)) {
    console.warn(`[checkout] rejecting malformed preapproval_id (${preapprovalId.length} chars)`)
    return { state: 'error' }
  }

  // Throttle before any outbound call. Fails loud when no client address is
  // resolvable — pooling unidentified clients into one bucket would 429
  // unrelated customers (same rule as the subscription endpoint).
  let clientAddress: string
  try {
    clientAddress = clientIpAddress(getClientAddress)
  } catch (error) {
    if (error instanceof ClientAddressError) {
      console.error('[checkout] cannot determine client IP for completion verification; refusing request')
      return { state: 'error' }
    }
    throw error
  }
  const rateLimit = checkRateLimit(rateLimitKey('subscriptionVerify', clientAddress))
  if (!rateLimit.allowed) {
    console.warn('[checkout] completion verification rate limit exceeded')
    return { state: 'rate_limited' }
  }

  let subscription
  try {
    subscription = await getSubscription(preapprovalId)
  } catch (err) {
    if (err instanceof MercadoPagoError) {
      // Loud on the server log; the customer still gets a truthful page.
      console.error(`[checkout] completion verification failed: ${err.code}`)
      return { state: 'error' }
    }
    throw err
  }

  if (!subscription) return { state: 'error' }

  if (subscription.status === 'authorized') {
    return { state: 'confirmed', subscriptionId: subscription.id }
  }
  // pending / paused / cancelled — never claim success for these.
  return { state: 'pending', subscriptionId: subscription.id }
}
