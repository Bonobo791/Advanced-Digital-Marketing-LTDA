import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { processWebhookEvent } from '$lib/server/mercadoPago-webhook'

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
    // Loud on the server log, terse to the caller. MP retries non-2xx: a
    // misconfigured secret (503) and a transient processing failure (500,
    // event unmarked) should be retried; a bad signature / stale timestamp is
    // rejected outright (401) — retrying would never succeed.
    console.error(`[mercadoPago-webhook] rejected webhook: ${outcome.code}`)
    const status =
      outcome.code === 'missing_secret' ? 503 : outcome.code === 'processing_failed' ? 500 : 401
    return json({ error: outcome.code }, { status })
  }

  return json({ ok: true })
}
