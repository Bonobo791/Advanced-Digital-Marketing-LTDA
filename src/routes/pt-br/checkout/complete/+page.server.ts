import type { PageServerLoad } from './$types'
import { MercadoPagoError, getSubscription } from '$lib/server/mercadoPago'

// The return page must verify the redirect server-side (it reads the
// preapproval_id query param), so it cannot be prerendered.
export const prerender = false

export type CompletionState =
  | { state: 'missing' }
  | { state: 'confirmed'; subscriptionId: string }
  | { state: 'pending'; subscriptionId: string }
  | { state: 'error' }

/**
 * Verifies the subscription the customer was redirected from before claiming
 * success. Mercado Pago's hosted checkout appends `preapproval_id` to the
 * back_url; the page only reports "processada" when the preapproval status is
 * `authorized` (verified live against the API). Anything else renders a
 * pending/error state instead of an unconditional success claim.
 */
export const load: PageServerLoad = async ({ url }): Promise<CompletionState> => {
  const preapprovalId = url.searchParams.get('preapproval_id')
  if (!preapprovalId) return { state: 'missing' }

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
