import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { processStripeWebhookEvent } from '$lib/server/stripe-webhook'

// Stripe webhook receiver (see docs/stripe-checkout.md). Signature-verified
// before any work; unverified requests get 401 and never touch the Stripe API.
export const prerender = false

export const POST: RequestHandler = async ({ request }) => {
  const payload = await request.text()
  const outcome = await processStripeWebhookEvent({
    payload,
    signatureHeader: request.headers.get('stripe-signature'),
  })

  if (!outcome.handled) {
    console.error(`[stripe-webhook] rejected webhook: ${outcome.code}`)
    // Stripe retries non-2xx: a misconfigured secret (503) and a transient
    // processing failure (500, event unmarked) should be retried; a bad
    // signature / stale timestamp / malformed event is rejected (400) — a
    // retry would never succeed.
    const status = outcome.code === 'missing_secret' ? 503 : outcome.code === 'processing_failed' ? 500 : 400
    return json({ error: outcome.code }, { status })
  }

  return json({ ok: true })
}
