/**
 * Guards the Mercado Pago webhook contract (src/lib/server/mercadoPago-webhook.ts):
 * HMAC signature verification with recency (replay) protection, in-memory
 * redelivery dedupe, and the owner notification firing only for approved
 * payments / authorized subscriptions.
 */
import { createHmac } from 'node:crypto'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { MailjetMessageInput } from './mailjet'
import {
  parseSignatureHeader,
  processWebhookEvent,
  resetWebhookDedupe,
  verifyWebhookSignature,
  type WebhookOutcome,
} from './mercadoPago-webhook'

const SECRET = 'test-webhook-secret'

/** Builds a signed body exactly as Mercado Pago does. */
function signedBody(payload: Record<string, unknown>, opts: { secret?: string; ts?: number; requestId?: string } = {}): {
  body: string
  xSignature: string
  xRequestId: string
  urlDataId: string
  ts: number
} {
  const body = JSON.stringify(payload)
  const data = payload.data as Record<string, unknown>
  const ts = opts.ts ?? Math.floor(Date.now() / 1000)
  const requestId = opts.requestId ?? 'req-123'
  const rawData = payload.data as { id?: unknown } | undefined
  const urlDataId = typeof rawData?.id === 'string' ? rawData.id.toLowerCase() : ''
  // Mercado Pago signs the URL query data.id (lowercased), never the body id.
  const manifest = `id:${urlDataId};request-id:${requestId};ts:${ts};`
  const v1 = createHmac('sha256', opts.secret ?? SECRET).update(manifest).digest('hex')
  return { body, xSignature: `ts=${ts},v1=${v1}`, xRequestId: requestId, urlDataId, ts }
}

const paymentEvent = (id = '123456') => ({
  action: 'payment.created',
  type: 'payment',
  data: { id },
  live_mode: false,
})

describe('parseSignatureHeader', () => {
  it('parses ts and v1 from the x-signature header', () => {
    expect(parseSignatureHeader('ts=1701340300,v1=9d6c3fabc')).toEqual({ ts: 1701340300, v1: '9d6c3fabc' })
  })

  it('returns undefined for missing or malformed headers', () => {
    expect(parseSignatureHeader(null)).toBeUndefined()
    expect(parseSignatureHeader('v1=abc')).toBeUndefined()
    expect(parseSignatureHeader('ts=abc,v1=abc')).toBeUndefined()
  })
})

describe('verifyWebhookSignature', () => {
  it('accepts a correctly signed event', () => {
    const { body, xSignature, xRequestId, urlDataId } = signedBody(paymentEvent())
    const result = verifyWebhookSignature({ body, xSignature, xRequestId, urlDataId: '123456', secret: SECRET })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.ts).toBeGreaterThan(0)
  })

  it('rejects a wrong secret', () => {
    const { body, xSignature, xRequestId, urlDataId } = signedBody(paymentEvent())
    const result = verifyWebhookSignature({ body, xSignature, xRequestId, urlDataId: '123456', secret: 'wrong' })
    expect(result).toEqual({ ok: false, code: 'bad_signature' })
  })

  it('rejects a tampered body', () => {
    const { xSignature, xRequestId } = signedBody(paymentEvent('123456'))
    const tampered = JSON.stringify(paymentEvent('999999'))
    const result = verifyWebhookSignature({ body: tampered, xSignature, xRequestId, urlDataId: '999999', secret: SECRET })
    expect(result).toEqual({ ok: false, code: 'bad_signature' })
  })

  it('lowercases the URL data.id in the signature manifest', () => {
    // Uppercase ids in the URL query must be lowercased before hashing.
    const { body, xSignature, xRequestId } = signedBody(paymentEvent('ORD123ABC'))
    const result = verifyWebhookSignature({ body, xSignature, xRequestId, urlDataId: 'ORD123ABC', secret: SECRET })
    expect(result.ok).toBe(true)
  })

  it('reports missing_secret when the secret is not configured', () => {
    const { body, xSignature, xRequestId, urlDataId } = signedBody(paymentEvent())
    expect(verifyWebhookSignature({ body, xSignature, xRequestId, urlDataId: '123456', secret: '' })).toEqual({
      ok: false,
      code: 'missing_secret',
    })
  })

  it('rejects a stale timestamp (replay)', async () => {
    vi.stubEnv('MERCADO_PAGO_WEBHOOK_SECRET', SECRET)
    const old = signedBody(paymentEvent(), { ts: Math.floor(Date.now() / 1000) - 3600 })
    const outcome = await processWebhookEvent({
      body: old.body,
      xSignature: old.xSignature,
      xRequestId: old.xRequestId,
      urlDataId: old.urlDataId,
      getPaymentImpl: vi.fn(),
    })
    expect(outcome).toEqual({ handled: false, code: 'stale_timestamp' })
  })

  it('rejects a future-dated timestamp (replay window must not ride forward)', async () => {
    vi.stubEnv('MERCADO_PAGO_WEBHOOK_SECRET', SECRET)
    const future = signedBody(paymentEvent(), { ts: Math.floor(Date.now() / 1000) + 3600 })
    const outcome = await processWebhookEvent({
      body: future.body,
      xSignature: future.xSignature,
      xRequestId: future.xRequestId,
      urlDataId: future.urlDataId,
      getPaymentImpl: vi.fn(),
    })
    expect(outcome).toEqual({ handled: false, code: 'stale_timestamp' })
  })
})

describe('processWebhookEvent', () => {
  beforeEach(() => {
    vi.stubEnv('MERCADO_PAGO_WEBHOOK_SECRET', SECRET)
    resetWebhookDedupe()
  })

  afterEach(() => vi.unstubAllEnvs())

  it('notifies the owner when a payment is approved', async () => {
    const sendEmail = vi.fn(async (_input: MailjetMessageInput) => ({ messageId: 'm1' }))
    const getPaymentImpl = vi.fn(async () => ({
      id: '123456',
      status: 'approved',
      statusDetail: 'accredited',
      externalReference: 'website-build:website:new',
      transactionAmount: 3000,
      currencyId: 'BRL',
      payerEmail: 'customer@example.com',
    }))
    const { body, xSignature, xRequestId, urlDataId } = signedBody(paymentEvent())
    const outcome = await processWebhookEvent({ body, xSignature, xRequestId, urlDataId, getPaymentImpl, sendEmail })
    expect(outcome).toEqual({ handled: true, action: 'payment' })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0].subject).toContain('Payment approved')
    expect(sendEmail.mock.calls[0][0].textPart).toContain('website-build:website:new')
  })

  it('does not notify for non-approved payments', async () => {
    const sendEmail = vi.fn()
    const getPaymentImpl = vi.fn(async () => ({
      id: '123456',
      status: 'pending',
      statusDetail: null,
      externalReference: 'x',
      transactionAmount: 10,
      currencyId: 'BRL',
      payerEmail: null,
    }))
    const { body, xSignature, xRequestId, urlDataId } = signedBody(paymentEvent())
    const outcome = await processWebhookEvent({ body, xSignature, xRequestId, urlDataId, getPaymentImpl, sendEmail })
    expect(outcome).toEqual({ handled: true, action: 'payment' })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('notifies the owner when a subscription is authorized', async () => {
    const sendEmail = vi.fn(async (_input: MailjetMessageInput) => ({ messageId: 'm1' }))
    const getSubscriptionImpl = vi.fn(async () => ({
      id: 's1',
      status: 'authorized',
      reason: 'Conteúdo SEO + Hospedagem',
      externalReference: 'seo-content+hosting',
      payerEmail: 'customer@example.com',
      transactionAmount: 2300,
      currencyId: 'BRL',
    }))
    const { body, xSignature, xRequestId, urlDataId } = signedBody({ action: 'preapproval.updated', type: 'preapproval', data: { id: 's1' } })
    const outcome = await processWebhookEvent({ body, xSignature, xRequestId, urlDataId, getSubscriptionImpl, sendEmail })
    expect(outcome).toEqual({ handled: true, action: 'preapproval' })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0].subject).toContain('Subscription authorized')
  })

  it('acknowledges redelivered events without a second email (dedupe)', async () => {
    const sendEmail = vi.fn(async (_input: MailjetMessageInput) => ({ messageId: 'm1' }))
    const getPaymentImpl = vi.fn(async () => ({
      id: '123456',
      status: 'approved',
      statusDetail: 'accredited',
      externalReference: 'x',
      transactionAmount: 10,
      currencyId: 'BRL',
      payerEmail: null,
    }))
    const first = signedBody(paymentEvent())
    const second = signedBody(paymentEvent(), { requestId: 'req-456' })
    const firstOutcome = await processWebhookEvent({ body: first.body, xSignature: first.xSignature, xRequestId: first.xRequestId, urlDataId: first.urlDataId, getPaymentImpl, sendEmail })
    const secondOutcome = await processWebhookEvent({ body: second.body, xSignature: second.xSignature, xRequestId: second.xRequestId, urlDataId: second.urlDataId, getPaymentImpl, sendEmail })
    expect(firstOutcome.handled).toBe(true)
    expect(secondOutcome).toEqual({ handled: true, action: 'deduplicated' })
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('ignores other webhook topics (chargebacks, plans, ...) but acknowledges them', async () => {
    const sendEmail = vi.fn()
    const { body, xSignature, xRequestId, urlDataId } = signedBody({ action: 'chargebacks.created', type: 'chargebacks', data: { id: 'c1' } })
    const outcome = await processWebhookEvent({ body, xSignature, xRequestId, urlDataId, sendEmail })
    expect(outcome).toEqual({ handled: true, action: 'ignored' })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('unmarks a failed event so a redelivery retries the owner notification', async () => {
    // A transient lookup/email failure must not lose the notification: the
    // event is unmarked and returned as processing_failed (the route answers
    // 5xx, MP redelivers), and the retry with a healthy notifier processes it.
    const failing = vi.fn(async () => {
      throw new Error('mailjet down')
    })
    const getPaymentImpl = vi.fn(async () => ({
      id: '1234567890',
      status: 'approved',
      statusDetail: 'accredited',
      externalReference: 'website-build:website:new',
      transactionAmount: 3000,
      currencyId: 'BRL',
    }))
    const first = signedBody(paymentEvent())
    const failed = await processWebhookEvent({
      body: first.body,
      xSignature: first.xSignature,
      xRequestId: first.xRequestId,
      urlDataId: first.urlDataId,
      getPaymentImpl,
      sendEmail: failing,
    })
    expect(failed).toEqual({ handled: false, code: 'processing_failed' })

    const healthy = vi.fn(async () => ({ messageId: 'm1' }))
    const second = signedBody(paymentEvent())
    const retried = await processWebhookEvent({
      body: second.body,
      xSignature: second.xSignature,
      xRequestId: second.xRequestId,
      urlDataId: second.urlDataId,
      getPaymentImpl,
      sendEmail: healthy,
    })
    expect(retried).toEqual({ handled: true, action: 'payment' })
    expect(healthy).toHaveBeenCalledTimes(1)
  })

  it('rejects unsigned or malformed bodies before any work', async () => {
    vi.stubEnv('MERCADO_PAGO_WEBHOOK_SECRET', SECRET)
    const outcome = await processWebhookEvent({ body: 'not json', xSignature: null, xRequestId: null, urlDataId: null })
    expect(outcome).toEqual({ handled: false, code: 'bad_signature' })
  })
})
