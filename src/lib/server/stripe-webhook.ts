/**
 * Stripe webhook handling for `POST /api/webhooks/stripe`.
 *
 * The one actionable event today is `checkout.session.completed` with
 * `payment_status: paid`: email the owner (the same handoff the Mercado Pago
 * webhook provides for BRL flows). Signature-verified with the
 * `STRIPE_WEBHOOK_SECRET`; redeliveries are deduped in memory.
 */
import { EMAIL } from '$lib/constants'
import { MailjetError, sendMailjetMessage } from './mailjet.ts'
import {
  STRIPE_SIGNATURE_MAX_AGE_SECONDS,
  StripeError,
  getCheckoutSession,
  verifyStripeWebhookSignature,
  type CheckoutSessionStatus,
} from './stripe.ts'
import { isProcessed, markProcessed, unmarkProcessed } from './webhook-dedupe.ts'

// Re-exported so existing consumers/tests keep importing it from this module.
export { resetWebhookDedupe } from './webhook-dedupe.ts'

export type StripeWebhookOutcome =
  | { handled: true; action: string }
  | { handled: false; code: 'missing_secret' | 'bad_signature' | 'stale_timestamp' | 'malformed' | 'processing_failed' }

/**
 * Determines the inbox address used for owner notifications.
 *
 * @returns The configured owner email address, or the site contact address when no owner email is configured.
 */
function ownerEmail(): string {
  const configured = process.env.CONTACT_FORM_OWNER_EMAIL?.trim()
  if (configured) return configured
  console.error('[stripe-webhook] CONTACT_FORM_OWNER_EMAIL is not set; using the site contact address as the owner inbox')
  return EMAIL
}

function sessionNotificationText(session: CheckoutSessionStatus): string {
  const reference = session.clientReferenceId ?? '(no reference)'
  const amount =
    session.amountTotal === null ? '(unknown)' : `USD ${session.amountTotal}`
  return [
    'A new Stripe checkout session was completed and paid.',
    '',
    `Session id: ${session.id}`,
    `Reference: ${reference}`,
    `Amount: ${amount}`,
    `Customer email: ${session.customerEmail ?? '(not provided)'}`,
    '',
    'Manage it in the Stripe dashboard: Dashboard → Payments.',
  ].join('\n')
}

/**
 * Processes a verified Stripe webhook event and sends an owner notification for paid checkout sessions.
 *
 * Duplicate events are acknowledged without sending another notification. Unsupported event types are acknowledged without action, while processing failures remain retryable.
 *
 * @param input - Webhook payload, signature, optional timestamp, and injectable session and email handlers.
 * @returns The webhook handling result, including whether the event was handled and the resulting action or failure code.
 */
export async function processStripeWebhookEvent(input: {
  payload: string
  signatureHeader: string | null | undefined
  now?: number
  getSessionImpl?: typeof getCheckoutSession
  sendEmail?: typeof sendMailjetMessage
}): Promise<StripeWebhookOutcome> {
  const now = input.now ?? Date.now()
  const getSession = input.getSessionImpl ?? getCheckoutSession
  const sendEmail = input.sendEmail ?? sendMailjetMessage

  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? ''
  const verified = verifyStripeWebhookSignature({ payload: input.payload, signatureHeader: input.signatureHeader, secret })
  if (!verified.ok) return { handled: false, code: verified.code }
  // Reject BOTH directions outside the window (same rule as the Mercado Pago
  // webhook): a future-dated signature would otherwise ride the replay window.
  const age = now - verified.ts * 1000
  if (age < 0 || age > STRIPE_SIGNATURE_MAX_AGE_SECONDS * 1000) {
    return { handled: false, code: 'stale_timestamp' }
  }

  const event = parseStripeEvent(input.payload)
  if (!event) return { handled: false, code: 'malformed' }
  const { eventId, type, sessionId } = event
  if (!eventId) return { handled: false, code: 'malformed' }

  if (isProcessed(eventId)) {
    console.info(`[stripe-webhook] duplicate event ${eventId}; acknowledging without re-notifying`)
    return { handled: true, action: 'deduplicated' }
  }

  // Only checkout.session.completed drives an action today; other event types
  // are valid but have no handler — acknowledge them so Stripe stops retrying.
  if (type !== 'checkout.session.completed') {
    markProcessed(eventId)
    console.info(`[stripe-webhook] ignoring event type ${type || '(unknown)'} (no action configured)`)
    return { handled: true, action: 'ignored' }
  }
  if (!sessionId) return { handled: false, code: 'malformed' }

  // Marked only after event + session validation: a lookup or notification
  // failure unmarks (below) so Stripe's redelivery (route returns 5xx for
  // processing_failed) retries instead of acknowledging a lost notification.
  markProcessed(eventId)

  try {
    await notifyPaidSession(sessionId, getSession, sendEmail)
    return { handled: true, action: 'checkout.session.completed' }
  } catch (error) {
    // Loud on the server log AND retryable: unmark so Stripe's redelivery can
    // process the event again instead of permanently losing the notification.
    unmarkProcessed(eventId)
    if (error instanceof StripeError) {
      console.error(`[stripe-webhook] session lookup failed for ${sessionId}: ${error.code}`)
    } else if (error instanceof MailjetError) {
      console.error(`[stripe-webhook] owner notification failed for ${sessionId}: ${error.code}`)
    } else {
      console.error(`[stripe-webhook] processing failed for ${sessionId}`, error)
    }
    return { handled: false, code: 'processing_failed' }
  }
}

/** Parses the Stripe event payload into its id, type and (for completed
 *  sessions) the session id — kept separate so the processor stays flat. */
function parseStripeEvent(payload: string): { eventId: string | undefined; type: string; sessionId: string | undefined } | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const record = parsed as Record<string, unknown>
  const eventId = typeof record.id === 'string' ? record.id : undefined
  const type = typeof record.type === 'string' ? record.type : ''
  const object = typeof record.data === 'object' && record.data !== null ? (record.data as Record<string, unknown>).object : undefined
  const sessionId = typeof object === 'object' && object !== null ? (object as Record<string, unknown>).id : undefined
  return { eventId, type, sessionId: typeof sessionId === 'string' ? sessionId : undefined }
}

/** Emails the owner when the completed session is paid. Throws on failure. */
async function notifyPaidSession(
  sessionId: string,
  getSession: typeof getCheckoutSession,
  sendEmail: typeof sendMailjetMessage,
): Promise<void> {
  const session = await getSession(sessionId)
  if (session?.paymentStatus === 'paid') {
    await sendEmail({
      toEmail: ownerEmail(),
      toName: 'Advanced Digital Marketing',
      subject: `Stripe payment completed: ${session.clientReferenceId ?? session.id}`,
      textPart: sessionNotificationText(session),
    })
    console.log(`[stripe-webhook] session ${sessionId} paid; owner notified`)
  }
}
