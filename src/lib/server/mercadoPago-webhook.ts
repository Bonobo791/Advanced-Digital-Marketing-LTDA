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

/** Webhook signature timestamps older than this are rejected as replays. */
export const SIGNATURE_MAX_AGE_SECONDS = 5 * 60

/** Bounded in-memory dedupe: `type:data.id` -> expiry epoch ms. */
const processedEvents = new Map<string, number>()
const MAX_PROCESSED_EVENTS = 5_000
/** Redelivered events within this window are treated as already handled. */
const DEDUPE_TTL_MS = 24 * 60 * 60_000

export type WebhookOutcome =
  | { handled: true; action: string }
  | { handled: false; code: 'missing_secret' | 'bad_signature' | 'stale_timestamp' }

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
 * Verifies the webhook signature per Mercado Pago's scheme. Returns the
 * parsed timestamp when valid (caller checks recency).
 */
export function verifyWebhookSignature(input: {
  body: string
  xSignature: string | null | undefined
  xRequestId: string | null | undefined
  dataId: string | undefined
  secret: string
}): { ok: true; ts: number } | { ok: false; code: 'missing_secret' | 'bad_signature' | 'stale_timestamp'; ts?: number } {
  if (!input.secret) return { ok: false, code: 'missing_secret' }
  const parsed = parseSignatureHeader(input.xSignature)
  if (!parsed) return { ok: false, code: 'bad_signature' }
  const manifest = `id:${input.dataId ?? ''};request-id:${input.xRequestId ?? ''};ts:${parsed.ts};`
  const expected = createHmac('sha256', input.secret).update(manifest).digest('hex')
  if (!hexEqual(expected, parsed.v1)) return { ok: false, code: 'bad_signature' }
  return { ok: true, ts: parsed.ts }
}

/** True when the event was already processed (redelivery dedupe). */
function isProcessed(key: string): boolean {
  const expiry = processedEvents.get(key)
  if (expiry === undefined) return false
  if (expiry < Date.now()) {
    processedEvents.delete(key)
    return false
  }
  return true
}

function markProcessed(key: string): void {
  if (processedEvents.size >= MAX_PROCESSED_EVENTS) {
    // Bound the map: drop expired entries; if still full, drop the oldest.
    const now = Date.now()
    for (const [k, expiry] of processedEvents) {
      if (expiry < now) processedEvents.delete(k)
    }
    if (processedEvents.size >= MAX_PROCESSED_EVENTS) {
      const oldest = processedEvents.keys().next().value
      if (oldest !== undefined) processedEvents.delete(oldest)
    }
  }
  processedEvents.set(key, Date.now() + DEDUPE_TTL_MS)
}

/** Clears the in-memory redelivery dedupe (test isolation). */
export function resetWebhookDedupe(): void {
  processedEvents.clear()
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
  return [
    'A new payment was approved on the site.',
    '',
    `Payment id: ${payment.id}`,
    `Reference: ${reference}`,
    `Amount: ${amount}`,
    `Status: ${payment.status}${payment.statusDetail ? ` (${payment.statusDetail})` : ''}`,
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
 * Processes one webhook event: verifies the signature, looks up the resource,
 * and emails the owner when the state transition is actionable. Idempotent —
 * redelivered events are acknowledged without a second email.
 */
export async function processWebhookEvent(input: {
  body: string
  xSignature: string | null | undefined
  xRequestId: string | null | undefined
  now?: number
  getPaymentImpl?: typeof getPayment
  getSubscriptionImpl?: typeof getSubscription
  sendEmail?: typeof sendMailjetMessage
}): Promise<WebhookOutcome> {
  const now = input.now ?? Date.now()
  const getPaymentFn = input.getPaymentImpl ?? getPayment
  const getSubscriptionFn = input.getSubscriptionImpl ?? getSubscription
  const sendEmail = input.sendEmail ?? sendMailjetMessage

  let parsed: unknown
  try {
    parsed = JSON.parse(input.body)
  } catch {
    return { handled: false, code: 'bad_signature' }
  }
  if (typeof parsed !== 'object' || parsed === null) return { handled: false, code: 'bad_signature' }
  const record = parsed as Record<string, unknown>
  const data = typeof record.data === 'object' && record.data !== null ? (record.data as Record<string, unknown>) : {}
  const dataId = typeof data.id === 'string' ? data.id : undefined
  const type = typeof record.type === 'string' ? record.type : ''

  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim() ?? ''
  const verified = verifyWebhookSignature({
    body: input.body,
    xSignature: input.xSignature,
    xRequestId: input.xRequestId,
    dataId,
    secret,
  })
  if (!verified.ok) return { handled: false, code: verified.code }
  if (now - verified.ts * 1000 > SIGNATURE_MAX_AGE_SECONDS * 1000) {
    return { handled: false, code: 'stale_timestamp' }
  }
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
    if (type === 'payment') {
      const payment = await getPaymentFn(dataId)
      if (payment && payment.status === 'approved') {
        await sendEmail({
          toEmail: ownerEmail(),
          toName: 'Advanced Digital Marketing',
          subject: `Payment approved: ${payment.externalReference ?? payment.id}`,
          textPart: paymentNotificationText(payment),
        })
        console.log(`[mercadoPago-webhook] payment ${dataId} approved; owner notified`)
      }
      return { handled: true, action: 'payment' }
    }

    const subscription = await getSubscriptionFn(dataId)
    if (subscription && subscription.status === 'authorized') {
      await sendEmail({
        toEmail: ownerEmail(),
        toName: 'Advanced Digital Marketing',
        subject: `Subscription authorized: ${subscription.externalReference ?? subscription.id}`,
        textPart: subscriptionNotificationText(subscription),
      })
      console.log(`[mercadoPago-webhook] subscription ${dataId} authorized; owner notified`)
    }
    return { handled: true, action: 'preapproval' }
  } catch (error) {
    // A look-up or email failure is loud, but the webhook is still
    // acknowledged (2xx) so MP stops retrying; MP's own panel retains the
    // event history for reconciliation, and the failure is on our log.
    if (error instanceof MercadoPagoError) {
      console.error(`[mercadoPago-webhook] lookup failed for ${key}: ${error.code}`)
    } else if (error instanceof MailjetError) {
      console.error(`[mercadoPago-webhook] owner notification failed for ${key}: ${error.code}`)
    } else {
      console.error(`[mercadoPago-webhook] processing failed for ${key}`, error)
    }
    return { handled: true, action: 'failed-loud' }
  }
}
