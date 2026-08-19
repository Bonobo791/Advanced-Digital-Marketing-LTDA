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
  })

  if (!outcome.handled) {
    // Loud on the server log, terse to the caller. MP retries non-2xx, which
    // is what we want for a misconfigured secret (503) — but a bad signature
    // is rejected outright (401).
    console.error(`[mercadoPago-webhook] rejected webhook: ${outcome.code}`)
    const status = outcome.code === 'missing_secret' ? 503 : 401
    return json({ error: outcome.code }, { status })
  }

  return json({ ok: true })
}
