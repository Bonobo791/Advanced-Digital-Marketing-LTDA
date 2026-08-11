import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import { getMpPayment } from '$lib/server/mercadopago'
import {
  attachMpPayment,
  getOrder,
  mapMpStatusToOrderStatus,
  updateOrderStatus,
} from '$lib/server/orders'
import { isWebhookSignatureValid } from '$lib/server/webhook-signature'

export const prerender = false
export const trailingSlash = 'ignore'

function extractBodyId(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  const record = body as Record<string, unknown>
  const data = record.data as Record<string, unknown> | undefined
  const candidate = data?.id ?? record.id
  if (typeof candidate === 'string' || typeof candidate === 'number') return String(candidate)
  return null
}

/**
 * POST /api/webhooks/mercadopago
 *
 * Mercado Pago sends server-to-server notifications when a payment's status
 * changes. We never trust the notification body:
 *
 * 1. validate the x-signature when one is present and a secret is configured
 *    (the secret is generated in Suas integrações > Webhooks, not part of the
 *    test credentials); notifications delivered via the preference's
 *    notification_url are unsigned and are accepted without it
 * 2. fetch the real payment from Mercado Pago (the authoritative check)
 * 3. find the internal order via external_reference (= our order id)
 * 4. apply an idempotent, transition-guarded status update
 *
 * A fast 200/201 stops Mercado Pago's retries.
 */
export const POST: RequestHandler = async ({ request }) => {
  const url = new URL(request.url)
  const queryId =
    url.searchParams.get('data.id') ??
    url.searchParams.get('data_id') ??
    url.searchParams.get('id')

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    // Body is optional for our purposes; the signed data.id comes in the URL.
  }

  const paymentId = queryId ?? extractBodyId(body)
  if (!paymentId) {
    return json({ error: 'missing_payment_id' }, { status: 400 })
  }

  // Signature validation is defense-in-depth. Only notifications delivered to
  // the webhook URL configured in Suas integrações carry x-signature; the
  // real integrity check in every case is the authenticated re-fetch below.
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET
  const xSignature = request.headers.get('x-signature')
  if (secret && xSignature) {
    if (
      !isWebhookSignatureValid({
        xSignature,
        xRequestId: request.headers.get('x-request-id'),
        dataId: paymentId,
        secret,
      })
    ) {
      return json({ error: 'invalid_signature' }, { status: 401 })
    }
  } else if (secret && !xSignature) {
    console.warn('[webhook] unsigned notification received (preference-level delivery?)')
  }

  const payment = await getMpPayment(paymentId).catch(() => undefined)
  if (!payment) {
    return json({ error: 'payment_not_found' }, { status: 404 })
  }

  const db = await getDb().catch(() => undefined)
  if (!db) return json({ error: 'database_not_configured' }, { status: 503 })

  const orderId = payment.externalReference
  const order = orderId ? await getOrder(db, orderId) : undefined
  if (!order) {
    // Not one of our orders — acknowledge so Mercado Pago stops retrying.
    return json({ received: true })
  }

  const nextStatus = mapMpStatusToOrderStatus(payment.status)
  if (!nextStatus) {
    return json({ received: true })
  }

  // Only apply status from a payment that is (or becomes) the order's bound
  // payment — never from a second, different payment for the same order.
  const attach = await attachMpPayment(db, order.id, payment.id)
  if (!attach.ok) {
    return json({ received: true })
  }
  await updateOrderStatus(db, order.id, nextStatus, {
    mpStatus: payment.status,
    mpStatusDetail: payment.statusDetail ?? undefined,
    mpPaymentMethod: payment.paymentMethodId ?? undefined,
  })

  return json({ received: true })
}
