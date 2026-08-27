import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { processStripeWebhookEvent } from '$lib/server/stripe-webhook'
import { webhookRejectionStatus } from '$lib/server/webhook-status'

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
    // Stripe retries non-2xx; outright rejections get 400 (see
    // webhook-status.ts).
    console.error(`[stripe-webhook] rejected webhook: ${outcome.code}`)
    return json({ error: outcome.code }, { status: webhookRejectionStatus(outcome.code, 400) })
  }

  return json({ ok: true })
}
