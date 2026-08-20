import type { PageServerLoad } from './$types'
import { StripeError, getCheckoutSession, type CheckoutSessionStatus } from '$lib/server/stripe'
import { ClientAddressError, clientIpAddress } from '$lib/server/client-ip'
import { checkRateLimit, rateLimitKey } from '$lib/server/rate-limit'
import { getService } from '$lib/catalog'
import { authoritativeSubscriptionTotalUSD } from '$lib/server/pricing'
import { WEBSITE_BUILD_KINDS, WEBSITE_BUILD_TYPES, websiteBuildExternalReference, websiteBuildPrice } from '$lib/website-builds'

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

export const load: PageServerLoad = async ({ url, getClientAddress, setHeaders }): Promise<StripeCompletionState> => {
  // The rendered state is session-specific and must never be cached by Bunny
  // (same rule as the contact verification loaders).
  setHeaders({ 'Cache-Control': 'private, no-store' })

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

  return classifySession(session)
}

/**
 * Classifies a verified session into the page state. Every claim — paid OR
 * pending — requires the session to be bound to a server-created checkout
 * (wrong client_reference_id/amount/currency → loud error state, never a
 * success/pending claim for another product). Complete-but-unpaid is a
 * truthful "not confirmed", never a success claim.
 */
function classifySession(session: CheckoutSessionStatus): StripeCompletionState {
  if (session.paymentStatus === 'paid') {
    if (!isSiteStripeSession(session)) {
      console.warn(
        `[checkout-stripe] paid session ${session.id} does not match a server-created checkout ` +
          `(client_reference_id=${session.clientReferenceId}, amount=${session.amountTotal}, currency=${session.currency}); refusing success claim`,
      )
      return { state: 'error' }
    }
    return { state: 'confirmed', sessionId: session.id, amountTotal: session.amountTotal, clientReferenceId: session.clientReferenceId }
  }
  if (session.status === 'open' || session.status === 'processing' || session.paymentStatus === 'processing') {
    if (!isSiteStripeSession(session)) {
      console.warn(
        `[checkout-stripe] pending session ${session.id} does not match a server-created checkout ` +
          `(client_reference_id=${session.clientReferenceId}, amount=${session.amountTotal}, currency=${session.currency}); refusing pending claim`,
      )
      return { state: 'error' }
    }
    return { state: 'payment_pending', sessionId: session.id }
  }
  return { state: 'payment_unconfirmed', sessionId: session.id }
}

/**
 * True only when a session is bound to a checkout this server created:
 * the client_reference_id must be a deterministic website-build reference with
 * the exact server-derived USD amount, or a valid catalog subscription package
 * (fixed-price amounts must match exactly; ads-spend amounts must sit at or
 * above the US$ 100 floor) in USD. A paid session for anything else never
 * shows the success claim.
 */
function isSiteStripeSession(session: CheckoutSessionStatus): boolean {
  if (session.currency !== 'usd' || session.clientReferenceId === null || session.amountTotal === null) return false
  const reference = session.clientReferenceId

  for (const type of WEBSITE_BUILD_TYPES) {
    for (const kind of WEBSITE_BUILD_KINDS) {
      if (reference === websiteBuildExternalReference(type, kind)) {
        return session.amountTotal === websiteBuildPrice('en-US', type, kind)
      }
    }
  }

  const floor = authoritativeSubscriptionTotalUSD(reference)
  if (floor === null) return false
  const hasAdsSpend = reference.split('+').some((id) => getService(id)?.pricing.kind === 'ads-spend')
  return hasAdsSpend ? session.amountTotal >= floor : session.amountTotal === floor
}
