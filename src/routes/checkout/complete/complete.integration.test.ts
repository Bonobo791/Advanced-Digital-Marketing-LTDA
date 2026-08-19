/**
 * Guards the en-US Stripe return page (src/routes/checkout/complete/+page.server.ts):
 * live session verification before any success claim, malformed-id rejection,
 * per-IP rate limiting, and truthful unconfirmed states.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { load, type StripeCompletionState } from './+page.server'
import { getCheckoutSession, StripeError } from '$lib/server/stripe'
import { resetRateLimitBuckets } from '$lib/server/rate-limit'

vi.mock('$lib/server/stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/server/stripe')>()
  return { ...actual, getCheckoutSession: vi.fn() }
})

const mockGetSession = vi.mocked(getCheckoutSession)

const loadArgs = (query: string, ip = '203.0.113.9') => ({
  url: new URL(`https://example.com/checkout/complete/${query}`),
  request: new Request(`https://example.com/checkout/complete/${query}`),
  getClientAddress: (): string => ip,
})

const paidSession = {
  id: 'cs_test_1',
  status: 'complete',
  paymentStatus: 'paid',
  customerEmail: 'customer@example.com',
  amountTotal: 460,
  currency: 'usd',
  clientReferenceId: 'seo-content+hosting',
}

describe('checkout/complete (Stripe) load', () => {
  beforeEach(() => {
    mockGetSession.mockReset()
    resetRateLimitBuckets()
  })

  afterEach(() => vi.unstubAllEnvs())

  it('reports missing when there is no session_id', async () => {
    expect(await load(loadArgs('') as never)).toEqual({ state: 'missing' })
    expect(mockGetSession).not.toHaveBeenCalled()
  })

  it('confirms only a paid session and surfaces the verified amount', async () => {
    mockGetSession.mockResolvedValue(paidSession)
    expect(await load(loadArgs('?session_id=cs_test_1') as never)).toEqual({
      state: 'confirmed',
      sessionId: 'cs_test_1',
      amountTotal: 460,
      clientReferenceId: 'seo-content+hosting',
    })
  })

  it('reports pending while the session is open', async () => {
    mockGetSession.mockResolvedValue({ ...paidSession, status: 'open', paymentStatus: 'unpaid' })
    expect(await load(loadArgs('?session_id=cs_test_1') as never)).toEqual({
      state: 'payment_pending',
      sessionId: 'cs_test_1',
    })
  })

  it('reports unconfirmed for a complete-but-unpaid session (never claims success)', async () => {
    mockGetSession.mockResolvedValue({ ...paidSession, status: 'complete', paymentStatus: 'unpaid' })
    expect(await load(loadArgs('?session_id=cs_test_1') as never)).toEqual({
      state: 'payment_unconfirmed',
      sessionId: 'cs_test_1',
    })
  })

  it('rejects malformed session ids without touching the API', async () => {
    expect(await load(loadArgs('?session_id=<script>') as never)).toEqual({ state: 'error' })
    expect(mockGetSession).not.toHaveBeenCalled()
  })

  it('maps API failures to the error state loudly', async () => {
    mockGetSession.mockRejectedValue(new StripeError('api_error', 'boom'))
    expect(await load(loadArgs('?session_id=cs_test_1') as never)).toEqual({ state: 'error' })
  })

  it('reports error when the session does not exist', async () => {
    mockGetSession.mockResolvedValue(undefined)
    expect(await load(loadArgs('?session_id=cs_missing') as never)).toEqual({ state: 'error' })
  })

  it('rate-limits verification per client', async () => {
    mockGetSession.mockResolvedValue(paidSession)
    for (let i = 0; i < 10; i += 1) {
      expect(((await load(loadArgs('?session_id=cs_test_1') as never)) as StripeCompletionState).state).toBe('confirmed')
    }
    expect(await load(loadArgs('?session_id=cs_test_1') as never)).toEqual({ state: 'rate_limited' })
  })
})
