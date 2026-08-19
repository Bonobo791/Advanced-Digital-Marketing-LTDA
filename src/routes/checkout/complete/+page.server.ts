import type { PageServerLoad } from './$types'
import { StripeError, getCheckoutSession } from '$lib/server/stripe'
import { ClientAddressError, clientIpAddress } from '$lib/server/client-ip'
import { checkRateLimit, rateLimitKey } from '$lib/server/rate-limit'

// Stripe (en-US) return page: verifies the Checkout Session live against the
// Stripe API before claiming success — the browser query params alone are
// never proof of payment.
export const prerender = false

export type StripeCompletionState =
  | { state: 'missing' }
  | { state: 'confirmed'; sessionId: string; amountTotal: number | null; clientReferenceId: string | null }
  | { state: 'payment_pending'; sessionId: string }
  | { state: 'payment_unconfirmed'; sessionId: string }
  | { state: 'rate_limited' }
  | { state: 'error' }

const SESSION_ID_RE = /^[A-Za-z0-9_-]{1,128}$/

export const load: PageServerLoad = async ({ url, getClientAddress }): Promise<StripeCompletionState> => {
  const sessionId = url.searchParams.get('session_id')
  if (!sessionId) return { state: 'missing' }

  // Shape check before any outbound call or rate-limit spend.
  if (!SESSION_ID_RE.test(sessionId)) {
    console.warn(`[checkout-stripe] rejecting malformed session_id (${sessionId.length} chars)`)
    return { state: 'error' }
  }

  let address: string
  try {
    address = clientIpAddress(getClientAddress)
  } catch (error) {
    if (error instanceof ClientAddressError) {
      console.error('[checkout-stripe] cannot determine client IP for completion verification; refusing request')
      return { state: 'error' }
    }
    throw error
  }

  const rateLimit = checkRateLimit(rateLimitKey('stripeVerify', address))
  if (!rateLimit.allowed) {
    console.warn('[checkout-stripe] completion verification rate limit exceeded')
    return { state: 'rate_limited' }
  }

  let session
  try {
    session = await getCheckoutSession(sessionId)
  } catch (error) {
    if (error instanceof StripeError) {
      console.error(`[checkout-stripe] completion verification failed: ${error.code}`)
      return { state: 'error' }
    }
    throw error
  }
  if (!session) {
    console.warn(`[checkout-stripe] session ${sessionId} not found`)
    return { state: 'error' }
  }

  if (session.paymentStatus === 'paid') {
    return { state: 'confirmed', sessionId: session.id, amountTotal: session.amountTotal, clientReferenceId: session.clientReferenceId }
  }
  if (session.status === 'open' || session.status === 'processing' || session.paymentStatus === 'processing') {
    return { state: 'payment_pending', sessionId: session.id }
  }
  // complete-but-unpaid (unpaid/abandoned/expired) is a truthful "not
  // confirmed", never a success claim.
  return { state: 'payment_unconfirmed', sessionId: session.id }
}
