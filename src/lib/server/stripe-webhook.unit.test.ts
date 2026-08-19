/**
 * Guards the Stripe webhook contract (src/lib/server/stripe-webhook.ts):
 * signature verification, checkout.session.completed -> owner notification,
 * redelivery dedupe, and ignored event types.
 */
import { createHmac } from 'node:crypto'
import type { MailjetMessageInput } from './mailjet'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { processStripeWebhookEvent, resetWebhookDedupe } from './stripe-webhook'

const SECRET = 'whsec_test'

function signedEvent(payload: Record<string, unknown>, opts: { secret?: string; ts?: number } = {}): {
  payload: string
  signatureHeader: string
  ts: number
} {
  const body = JSON.stringify(payload)
  const ts = opts.ts ?? Math.floor(Date.now() / 1000)
  const v1 = createHmac('sha256', opts.secret ?? SECRET).update(`${ts}.${body}`).digest('hex')
  return { payload: body, signatureHeader: `t=${ts},v1=${v1}`, ts }
}

const completedEvent = (sessionId = 'cs_test_1', eventId = 'evt_1') => ({
  id: eventId,
  type: 'checkout.session.completed',
  data: { object: { id: sessionId } },
})

describe('processStripeWebhookEvent', () => {
  beforeEach(() => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', SECRET)
    resetWebhookDedupe()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('notifies the owner when a session is completed and paid', async () => {
    const sendEmail = vi.fn(async (_input: MailjetMessageInput) => ({ messageId: 'm1' }))
    const getSessionImpl = vi.fn(async () => ({
      id: 'cs_test_1',
      status: 'complete',
      paymentStatus: 'paid',
      customerEmail: 'customer@example.com',
      amountTotal: 460,
      currency: 'usd',
      clientReferenceId: 'seo-content+hosting',
    }))
    const { payload, signatureHeader } = signedEvent(completedEvent())
    const outcome = await processStripeWebhookEvent({ payload, signatureHeader, getSessionImpl, sendEmail })
    expect(outcome).toEqual({ handled: true, action: 'checkout.session.completed' })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0].subject).toContain('Stripe payment completed')
    expect(sendEmail.mock.calls[0][0].textPart).toContain('seo-content+hosting')
  })

  it('does not notify when the session is not paid', async () => {
    const sendEmail = vi.fn()
    const getSessionImpl = vi.fn(async () => ({
      id: 'cs_test_1',
      status: 'open',
      paymentStatus: 'unpaid',
      customerEmail: null,
      amountTotal: 460,
      currency: 'usd',
      clientReferenceId: 'x',
    }))
    const { payload, signatureHeader } = signedEvent(completedEvent())
    const outcome = await processStripeWebhookEvent({ payload, signatureHeader, getSessionImpl, sendEmail })
    expect(outcome.handled).toBe(true)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('dedupes redeliveries', async () => {
    const sendEmail = vi.fn(async (_input: MailjetMessageInput) => ({ messageId: 'm1' }))
    const getSessionImpl = vi.fn(async () => ({
      id: 'cs_test_1',
      status: 'complete',
      paymentStatus: 'paid',
      customerEmail: null,
      amountTotal: 100,
      currency: 'usd',
      clientReferenceId: 'x',
    }))
    const first = signedEvent(completedEvent())
    const second = signedEvent(completedEvent(), { ts: Math.floor(Date.now() / 1000) })
    const a = await processStripeWebhookEvent({ payload: first.payload, signatureHeader: first.signatureHeader, getSessionImpl, sendEmail })
    const b = await processStripeWebhookEvent({ payload: second.payload, signatureHeader: second.signatureHeader, getSessionImpl, sendEmail })
    expect(a.handled).toBe(true)
    expect(b).toEqual({ handled: true, action: 'deduplicated' })
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('acknowledges non-checkout event types without an action', async () => {
    const { payload, signatureHeader } = signedEvent({ id: 'evt_2', type: 'invoice.payment_failed', data: {} })
    const outcome = await processStripeWebhookEvent({ payload, signatureHeader, sendEmail: vi.fn() })
    expect(outcome).toEqual({ handled: true, action: 'ignored' })
  })

  it('rejects a bad signature before any work', async () => {
    const { payload, signatureHeader } = signedEvent(completedEvent(), { secret: 'wrong' })
    const outcome = await processStripeWebhookEvent({ payload, signatureHeader, sendEmail: vi.fn() })
    expect(outcome).toEqual({ handled: false, code: 'bad_signature' })
  })

  it('rejects a stale timestamp', async () => {
    const old = signedEvent(completedEvent(), { ts: Math.floor(Date.now() / 1000) - 3600 })
    const outcome = await processStripeWebhookEvent({ payload: old.payload, signatureHeader: old.signatureHeader, sendEmail: vi.fn() })
    expect(outcome).toEqual({ handled: false, code: 'stale_timestamp' })
  })

  it('reports missing_secret when unconfigured', async () => {
    vi.unstubAllEnvs()
    const { payload, signatureHeader } = signedEvent(completedEvent())
    const outcome = await processStripeWebhookEvent({ payload, signatureHeader, sendEmail: vi.fn() })
    expect(outcome).toEqual({ handled: false, code: 'missing_secret' })
  })

  it('does not consume the dedupe slot when the notification fails — a redelivery retries', async () => {
    // A transient MailJet/Stripe-API failure must not lose the owner
    // notification forever: the event is unmarked and returned as
    // processing_failed (the route answers 5xx, Stripe redelivers), and the
    // retry with a healthy notifier processes it exactly once.
    const getSessionImpl = vi.fn(async () => ({
      id: 'cs_test_1',
      status: 'complete',
      paymentStatus: 'paid',
      customerEmail: null,
      amountTotal: 100,
      currency: 'usd',
      clientReferenceId: 'seo-content',
    }))
    const failing = vi.fn(async () => {
      throw new Error('mailjet down')
    })
    const first = signedEvent(completedEvent())
    const failed = await processStripeWebhookEvent({
      payload: first.payload,
      signatureHeader: first.signatureHeader,
      getSessionImpl,
      sendEmail: failing,
    })
    expect(failed).toEqual({ handled: false, code: 'processing_failed' })

    const healthy = vi.fn(async (_input: MailjetMessageInput) => ({ messageId: 'm2' }))
    const second = signedEvent(completedEvent())
    const retried = await processStripeWebhookEvent({
      payload: second.payload,
      signatureHeader: second.signatureHeader,
      getSessionImpl,
      sendEmail: healthy,
    })
    expect(retried).toEqual({ handled: true, action: 'checkout.session.completed' })
    expect(healthy).toHaveBeenCalledTimes(1)
  })
})
