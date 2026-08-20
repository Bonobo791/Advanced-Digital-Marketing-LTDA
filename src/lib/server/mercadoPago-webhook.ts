/**
 * Mercado Pago webhook handling (spec §13 — the previously "intentionally not
 * implemented" piece).
 *
 * Mercado Pago posts event notifications to `POST /api/webhooks/mercadopago`
 * whenever a payment or subscription changes state. This module verifies the
 * signature, looks up the resource live, and performs the ONE action that
 * matters today: emailing the owner when a payment is approved or a
 * subscription is authorized (there is still no local billing database — the
 * notification is the handoff, everything else stays in Mercado Pago).
 *
 * Signature scheme (Mercado Pago docs): the `x-signature` header carries
 * `ts=<unix-seconds>,v1=<hex-hmac>` and the manifest is
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, HMAC-SHA256 with
 * `MERCADO_PAGO_WEBHOOK_SECRET`. The timestamp is also checked for recency so
 * a captured request cannot be replayed. Webhooks can be redelivered, so
 * events are deduped in memory by `type:data.id` (bounded; a later replay of
 * an event that already emailed the owner is acknowledged, not re-emailed).
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { EMAIL } from '$lib/constants'
import { MailjetError, sendMailjetMessage } from './mailjet.ts'
import {
  getPayment,
  getSubscription,
  MercadoPagoError,
  type PaymentStatus,
  type SubscriptionStatus,
} from './mercadoPago.ts'
import { isProcessed, markProcessed, unmarkProcessed } from './webhook-dedupe.ts'

// Re-exported so existing consumers/tests keep importing it from this module.
export { resetWebhookDedupe } from './webhook-dedupe.ts'

/** Webhook signature timestamps older (or further in the future) than this are rejected as replays. */
export const SIGNATURE_MAX_AGE_SECONDS = 5 * 60

export type WebhookOutcome =
  | { handled: true; action: string }
  | { handled: false; code: 'missing_secret' | 'bad_signature' | 'stale_timestamp' | 'processing_failed' }

/** Extracts `ts` and `v1` from the raw `x-signature` header value. */
export function parseSignatureHeader(value: string | null | undefined): { ts: number; v1: string } | undefined {
  if (!value) return undefined
  const ts = Number(/\bts=(\d+)/.exec(value)?.[1])
  const v1 = /\bv1=([0-9a-fA-F]+)/.exec(value)?.[1]
  if (!Number.isFinite(ts) || !v1) return undefined
  return { ts, v1 }
}

/** Constant-time hex compare of the computed and received HMACs. */
function hexEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex')
  const bb = Buffer.from(b, 'hex')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/**
 * Verifies the webhook signature per Mercado Pago's scheme. The manifest's id
 * component is the URL query `data.id` (the value Mercado Pago signed),
 * lowercased per the docs — uppercase ids in the query must be lowercased
 * before hashing. Returns the parsed timestamp when valid (caller checks
 * recency).
 */
export function verifyWebhookSignature(input: {
  body: string
  xSignature: string | null | undefined
  xRequestId: string | null | undefined
  urlDataId: string | undefined
  secret: string
}): { ok: true; ts: number } | { ok: false; code: 'missing_secret' | 'bad_signature' | 'stale_timestamp'; ts?: number } {
  if (!input.secret) return { ok: false, code: 'missing_secret' }
  const parsed = parseSignatureHeader(input.xSignature)
  if (!parsed) return { ok: false, code: 'bad_signature' }
  const manifestId = input.urlDataId ? input.urlDataId.toLowerCase() : ''
  const manifest = `id:${manifestId};request-id:${input.xRequestId ?? ''};ts:${parsed.ts};`
  const expected = createHmac('sha256', input.secret).update(manifest).digest('hex')
  if (!hexEqual(expected, parsed.v1)) return { ok: false, code: 'bad_signature' }
  return { ok: true, ts: parsed.ts }
}

/** Owner inbox — same default as the contact flow (loud fallback). */
function ownerEmail(): string {
  const configured = process.env.CONTACT_FORM_OWNER_EMAIL?.trim()
  if (configured) return configured
  console.error('[mercadoPago-webhook] CONTACT_FORM_OWNER_EMAIL is not set; using the site contact address as the owner inbox')
  return EMAIL
}

function paymentNotificationText(payment: PaymentStatus): string {
  const reference = payment.externalReference ?? '(no reference)'
  const amount =
    payment.transactionAmount === null
      ? '(unknown)'
      : `${payment.currencyId ?? 'BRL'} ${payment.transactionAmount}`
  const detail = payment.statusDetail ? ` (${payment.statusDetail})` : ''
  return [
    'A new payment was approved on the site.',
    '',
    `Payment id: ${payment.id}`,
    `Reference: ${reference}`,
    `Amount: ${amount}`,
    `Status: ${payment.status}${detail}`,
    '',
    'Manage it in the Mercado Pago panel: Mercado Pago → Payments.',
  ].join('\n')
}

function subscriptionNotificationText(subscription: SubscriptionStatus): string {
  const reference = subscription.externalReference ?? '(no reference)'
  const amount =
    subscription.transactionAmount === null
      ? '(unknown)'
      : `${subscription.currencyId ?? 'BRL'} ${subscription.transactionAmount}`
  return [
    'A new subscription was authorized on the site.',
    '',
    `Subscription id: ${subscription.id}`,
    `Reference: ${reference}`,
    `Reason: ${subscription.reason ?? '(none)'}`,
    `Amount: ${amount}`,
    `Payer email: ${subscription.payerEmail ?? '(not provided)'}`,
    '',
    'Manage it in the Mercado Pago panel: Mercado Pago → Subscriptions.',
  ].join('\n')
}

/**
 * Parses the webhook body into a validated event. The body `data.id` (string
 * or numeric) is normalized to a string for lookup/dedupe; the signature
 * manifest uses the URL query value instead (see authorize).
 */
function parseEvent(body: string): { dataId: string | undefined; type: string } | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const record = parsed as Record<string, unknown>
  const data = typeof record.data === 'object' && record.data !== null ? (record.data as Record<string, unknown>) : {}
  const rawId = data.id
  let dataId: string | undefined
  if (typeof rawId === 'string') {
    dataId = rawId
  } else if (typeof rawId === 'number' && Number.isFinite(rawId)) {
    dataId = String(rawId)
  }
  const type = typeof record.type === 'string' ? record.type : ''
  return { dataId, type }
}

/**
 * Signature + recency check (the "authorize" step). The manifest id comes from
 * the URL query `data.id` (lowercased), not the body.
 */
function authorize(input: {
  body: string
  xSignature: string | null | undefined
  xRequestId: string | null | undefined
  urlDataId: string | undefined
  secret: string
  now: number
}): { ok: true } | { ok: false; code: 'missing_secret' | 'bad_signature' | 'stale_timestamp' } {
  const verified = verifyWebhookSignature({
    body: input.body,
    xSignature: input.xSignature,
    xRequestId: input.xRequestId,
    urlDataId: input.urlDataId,
    secret: input.secret,
  })
  if (!verified.ok) return { ok: false, code: verified.code }
  // Reject BOTH directions outside the window: a stale signature is a replay,
  // and a future-dated one (negative age) would otherwise ride the window
  // until it becomes old — an attacker replaying a valid payload must not get
  // a free pass forward in time.
  const age = input.now - verified.ts * 1000
  if (age < 0 || age > SIGNATURE_MAX_AGE_SECONDS * 1000) {
    return { ok: false, code: 'stale_timestamp' }
  }
  return { ok: true }
}

/** One shared owner-notification path for both resource kinds. */
async function notifyOwner(
  sendEmail: typeof sendMailjetMessage,
  subject: string,
  textPart: string,
  logLine: string,
): Promise<void> {
  await sendEmail({
    toEmail: ownerEmail(),
    toName: 'Advanced Digital Marketing',
    subject,
    textPart,
  })
  console.log(`[mercadoPago-webhook] ${logLine}`)
}

/**
 * Looks up the resource and emails the owner when the state transition is
 * actionable. Throws on lookup/email failures so the caller can unmark and
 * return a retryable outcome.
 */
async function processResource(input: {
  type: string
  dataId: string
  getPaymentFn: typeof getPayment
  getSubscriptionFn: typeof getSubscription
  sendEmail: typeof sendMailjetMessage
}): Promise<WebhookOutcome> {
  if (input.type === 'payment') {
    const payment = await input.getPaymentFn(input.dataId)
    if (payment?.status === 'approved') {
      await notifyOwner(
        input.sendEmail,
        `Payment approved: ${payment.externalReference ?? payment.id}`,
        paymentNotificationText(payment),
        `payment ${input.dataId} approved; owner notified`,
      )
    }
    return { handled: true, action: 'payment' }
  }

  const subscription = await input.getSubscriptionFn(input.dataId)
  if (subscription?.status === 'authorized') {
    await notifyOwner(
      input.sendEmail,
      `Subscription authorized: ${subscription.externalReference ?? subscription.id}`,
      subscriptionNotificationText(subscription),
      `subscription ${input.dataId} authorized; owner notified`,
    )
  }
  return { handled: true, action: 'preapproval' }
}

/**
 * Processes one webhook event: verifies the signature, looks up the resource,
 * and emails the owner when the state transition is actionable. Idempotent —
 * redelivered events are acknowledged without a second email. A lookup or
 * notification failure unmarks the event and returns `processing_failed` so
 * the route can answer 5xx and Mercado Pago's redelivery retries the
 * notification (a transient failure must not lose the owner email forever).
 */
export async function processWebhookEvent(input: {
  body: string
  xSignature: string | null | undefined
  xRequestId: string | null | undefined
  urlDataId?: string | null
  now?: number
  getPaymentImpl?: typeof getPayment
  getSubscriptionImpl?: typeof getSubscription
  sendEmail?: typeof sendMailjetMessage
}): Promise<WebhookOutcome> {
  const now = input.now ?? Date.now()
  const getPaymentFn = input.getPaymentImpl ?? getPayment
  const getSubscriptionFn = input.getSubscriptionImpl ?? getSubscription
  const sendEmail = input.sendEmail ?? sendMailjetMessage

  const event = parseEvent(input.body)
  if (!event) return { handled: false, code: 'bad_signature' }
  const { dataId, type } = event

  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim() ?? ''
  const authorized = authorize({
    body: input.body,
    xSignature: input.xSignature,
    xRequestId: input.xRequestId,
    urlDataId: input.urlDataId ?? undefined,
    secret,
    now,
  })
  if (!authorized.ok) return { handled: false, code: authorized.code }
  if (!dataId) return { handled: false, code: 'bad_signature' }

  // Only payment/preapproval events drive an owner notification today. Other
  // topics (chargebacks, plans, point_integration_*, ...) are valid but have
  // no action here — acknowledge them so MP stops retrying.
  if (type !== 'payment' && type !== 'preapproval') {
    console.info(`[mercadoPago-webhook] ignoring webhook type ${type || '(unknown)'} (no action configured)`)
    return { handled: true, action: 'ignored' }
  }

  const key = `${type}:${dataId}`
  if (isProcessed(key)) {
    console.info(`[mercadoPago-webhook] duplicate event ${key}; acknowledging without re-notifying`)
    return { handled: true, action: 'deduplicated' }
  }
  markProcessed(key)

  try {
    return await processResource({ type, dataId, getPaymentFn, getSubscriptionFn, sendEmail })
  } catch (error) {
    // Loud on the server log AND retryable: unmark so MP's redelivery (the
    // route returns 5xx for this outcome) processes the event again instead
    // of acknowledging a permanently lost notification.
    unmarkProcessed(key)
    if (error instanceof MercadoPagoError) {
      console.error(`[mercadoPago-webhook] lookup failed for ${key}: ${error.code}`)
    } else if (error instanceof MailjetError) {
      console.error(`[mercadoPago-webhook] owner notification failed for ${key}: ${error.code}`)
    } else {
      console.error(`[mercadoPago-webhook] processing failed for ${key}`, error)
    }
    return { handled: false, code: 'processing_failed' }
  }
}
