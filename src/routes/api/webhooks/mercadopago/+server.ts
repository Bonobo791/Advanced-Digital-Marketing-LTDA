import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { processWebhookEvent } from '$lib/server/mercadoPago-webhook'
import { webhookRejectionStatus } from '$lib/server/webhook-status'

// Mercado Pago webhook receiver (see docs/mercado-pago-subscriptions.md).
// Signature-verified before any work; unverified requests get 401 and are
// never rate-limited or logged with payload content.
export const prerender = false

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.text()
  const outcome = await processWebhookEvent({
    body,
    xSignature: request.headers.get('x-signature'),
    xRequestId: request.headers.get('x-request-id'),
    // The signature manifest uses the URL query data.id (lowercased), which is
    // what Mercado Pago actually signed — never the body id.
    urlDataId: new URL(request.url).searchParams.get('data.id'),
  })

  if (!outcome.handled) {
    // Loud on the server log, terse to the caller. Mercado Pago retries
    // non-2xx; outright rejections get 401 (see webhook-status.ts).
    console.error(`[mercadoPago-webhook] rejected webhook: ${outcome.code}`)
    return json({ error: outcome.code }, { status: webhookRejectionStatus(outcome.code, 401) })
  }

  return json({ ok: true })
}
