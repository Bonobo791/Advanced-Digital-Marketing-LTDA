import type { PageServerLoad } from './$types'
import { isValidPaymentId, isValidPreapprovalId } from '$lib/server/checkout'
import { MercadoPagoError, getPayment, getSubscription } from '$lib/server/mercadoPago'
import { ClientAddressError, clientIpAddress } from '$lib/server/client-ip'
import { checkRateLimit, rateLimitKey } from '$lib/server/rate-limit'

// The return page must verify the redirect server-side (it reads the
// preapproval_id / payment_id query params), so it cannot be prerendered.
export const prerender = false

export type CompletionState =
  | { state: 'missing' }
  | { state: 'confirmed'; subscriptionId: string }
  | { state: 'payment_confirmed'; paymentId: string }
  | { state: 'payment_unconfirmed'; paymentId: string }
  | { state: 'pending'; subscriptionId: string }
  | { state: 'cancelled'; subscriptionId: string }
  | { state: 'rate_limited' }
  | { state: 'error' }

/**
 * Verifies the checkout the customer was redirected from before claiming
 * success. Two hosted-checkout flows land here:
 *  - subscriptions (Mercado Pago appends `preapproval_id`): confirmed only
 *    when the preapproval status is `authorized`;
 *  - one-time website builds (Checkout Pro appends `payment_id`, legacy
 *    `collection_id`): confirmed only when the payment status is `approved`.
 *
 * Abuse protection runs before the outbound call: this page is unauthenticated
 * and every request carrying a well-formed id triggers a paid Mercado Pago API
 * call, so requests are throttled per client IP with the same limiter used by
 * checkout creation. The shape check runs first so malformed identifiers are
 * rejected without touching the API or consuming rate-limit budget.
 */
export const load: PageServerLoad = async ({ url, getClientAddress }): Promise<CompletionState> => {
  const preapprovalId = url.searchParams.get('preapproval_id')
  if (preapprovalId) return verifySubscription(preapprovalId, getClientAddress)

  const paymentId = url.searchParams.get('payment_id') ?? url.searchParams.get('collection_id')
  if (paymentId) return verifyPayment(paymentId, getClientAddress)

  return { state: 'missing' }
}

type AddressResolution = { ok: true; address: string } | { ok: false }

/** Client IP, or the loud error state when it cannot be resolved at all. */
function clientAddressOrError(getClientAddress: () => string): AddressResolution {
  try {
    return { ok: true, address: clientIpAddress(getClientAddress) }
  } catch (error) {
    if (error instanceof ClientAddressError) {
      // Fail loudly (AGENTS.md): pooling unidentified clients into one bucket
      // would 429 unrelated customers (same rule as the checkout endpoints).
      console.error('[checkout] cannot determine client IP for completion verification; refusing request')
      return { ok: false }
    }
    throw error
  }
}

/**
 * Subscription branch: the page only reports "processada" when the preapproval
 * status is `authorized` (verified live against the API). Anything else
 * renders a pending/cancelled/error state instead of an unconditional success
 * claim.
 */
async function verifySubscription(
  preapprovalId: string,
  getClientAddress: () => string,
): Promise<CompletionState> {
  // Cheap shape check first (no outbound call): malformed identifiers are
  // rejected without consuming rate-limit budget, so a scripted flood of junk
  // cannot exhaust the bucket that guards the paid API call below. Same
  // validate-then-throttle ordering as the checkout endpoints.
  if (!isValidPreapprovalId(preapprovalId)) {
    console.warn(`[checkout] rejecting malformed preapproval_id (${preapprovalId.length} chars)`)
    return { state: 'error' }
  }

  const address = clientAddressOrError(getClientAddress)
  if (!address.ok) return { state: 'error' }

  const rateLimit = checkRateLimit(rateLimitKey('subscriptionVerify', address.address))
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
  // Paused/cancelled are terminal — the subscription will never progress to
  // authorization, so claiming it is 'still being processed' would be wrong.
  // Only genuinely progressing statuses get the pending state.
  if (subscription.status === 'paused' || subscription.status === 'cancelled') {
    return { state: 'cancelled', subscriptionId: subscription.id }
  }
  // pending (or any other non-terminal status) — never claim success.
  return { state: 'pending', subscriptionId: subscription.id }
}

/**
 * One-time payment branch (Checkout Pro): confirmed only when the payment
 * status is `approved`. Rejected, pending, refunded or any other status
 * renders an honest unconfirmed state — the page never claims success for a
 * payment Mercado Pago has not approved.
 */
async function verifyPayment(
  paymentId: string,
  getClientAddress: () => string,
): Promise<CompletionState> {
  if (!isValidPaymentId(paymentId)) {
    console.warn(`[checkout] rejecting malformed payment_id (${paymentId.length} chars)`)
    return { state: 'error' }
  }

  const address = clientAddressOrError(getClientAddress)
  if (!address.ok) return { state: 'error' }

  const rateLimit = checkRateLimit(rateLimitKey('paymentVerify', address.address))
  if (!rateLimit.allowed) {
    console.warn('[checkout] payment verification rate limit exceeded')
    return { state: 'rate_limited' }
  }

  let payment
  try {
    payment = await getPayment(paymentId)
  } catch (err) {
    if (err instanceof MercadoPagoError) {
      // Loud on the server log; the customer still gets a truthful page.
      console.error(`[checkout] payment verification failed: ${err.code}`)
      return { state: 'error' }
    }
    throw err
  }

  if (!payment) return { state: 'error' }

  if (payment.status === 'approved') {
    return { state: 'payment_confirmed', paymentId: payment.id }
  }
  return { state: 'payment_unconfirmed', paymentId: payment.id }
}
