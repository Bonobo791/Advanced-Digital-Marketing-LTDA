import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { load } from './+page.server'
import { isValidPaymentId, isValidPreapprovalId } from '$lib/server/checkout'
import { MercadoPagoError, getPayment, getSubscription } from '$lib/server/mercadoPago'
import { resetRateLimitBuckets } from '$lib/server/rate-limit'

vi.mock('$lib/server/mercadoPago', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/server/mercadoPago')>()
  return { ...actual, getSubscription: vi.fn(), getPayment: vi.fn() }
})

const mockGetSubscription = vi.mocked(getSubscription)
const mockGetPayment = vi.mocked(getPayment)

const urlFor = (query: string) =>
  new URL(`https://example.com/pt-br/checkout/complete/${query}`)

/** Minimal load event; getClientAddress defaults to a stable test IP. */
const loadArgs = (query: string, ip = '203.0.113.9') => ({
  url: urlFor(query),
  request: new Request(`https://example.com/pt-br/checkout/complete/${query}`),
  getClientAddress: (): string => ip,
})

// A real authorized preapproval is bound to a server-created subscription:
// external_reference is a catalog package, the amount equals the catalog
// price (or the ad-spend floor) and the currency is BRL.
const authorizedSubscription = {
  id: 'sub-42',
  status: 'authorized',
  reason: 'Conteúdo SEO',
  externalReference: 'seo-content',
  payerEmail: 'customer@example.com',
  transactionAmount: 2000,
  currencyId: 'BRL',
}

describe('checkout/complete load', () => {
  beforeEach(() => {
    mockGetSubscription.mockReset()
    mockGetPayment.mockReset()
    resetRateLimitBuckets()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('reports missing when the redirect carries no preapproval_id', async () => {
    expect(await load(loadArgs('') as never)).toEqual({ state: 'missing' })
    expect(mockGetSubscription).not.toHaveBeenCalled()
  })

  it('confirms only an authorized preapproval and surfaces the reference', async () => {
    mockGetSubscription.mockResolvedValue(authorizedSubscription)
    expect(await load(loadArgs('?preapproval_id=sub-42') as never)).toEqual({
      state: 'confirmed',
      subscriptionId: 'sub-42',
    })
    expect(mockGetSubscription).toHaveBeenCalledWith('sub-42')
  })

  it('never claims success for an authorized preapproval not bound to this checkout', async () => {
    // An authorized preapproval for another product / older integration must
    // not render the subscription-confirmed page: same binding rule as the
    // one-time payment branch (reference + amount + currency).
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const mismatches = [
        { externalReference: 'unrelated:product:1', transactionAmount: 2000, currencyId: 'BRL' },
        { externalReference: 'seo-content', transactionAmount: 1999, currencyId: 'BRL' },
        { externalReference: 'seo-content', transactionAmount: 2000, currencyId: 'USD' },
        { externalReference: null, transactionAmount: 2000, currencyId: 'BRL' },
        { externalReference: 'seo-content+seo-content', transactionAmount: 4000, currencyId: 'BRL' },
        { externalReference: 'backlinks+seo-content', transactionAmount: 5000, currencyId: 'BRL' },
        { externalReference: 'ai-automation', transactionAmount: 2000, currencyId: 'BRL' },
        { externalReference: 'unknown-service', transactionAmount: 2000, currencyId: 'BRL' },
      ]
      for (const patch of mismatches) {
        mockGetSubscription.mockResolvedValue({ ...authorizedSubscription, ...patch })
        expect(await load(loadArgs('?preapproval_id=sub-42') as never)).toEqual({
          state: 'error',
          kind: 'subscription',
        })
      }
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('does not match a server-created subscription'))
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('confirms every server-created catalog package', async () => {
    const combos = [
      { externalReference: 'seo-content', transactionAmount: 2000 },
      { externalReference: 'backlinks', transactionAmount: 3000 },
      { externalReference: 'hosting', transactionAmount: 300 },
      { externalReference: 'seo-content+backlinks+hosting', transactionAmount: 5300 },
    ]
    for (const patch of combos) {
      mockGetSubscription.mockResolvedValue({ ...authorizedSubscription, ...patch })
      expect(await load(loadArgs('?preapproval_id=sub-42') as never)).toEqual({
        state: 'confirmed',
        subscriptionId: 'sub-42',
      })
    }
  })

  it('confirms ads-spend subscriptions at or above the minimum fee', async () => {
    // Ads-spend packages record the fee for the customer's spend at creation
    // (>= the R$ 500 minimum); any amount at or above the floor is a
    // legitimate server-created package.
    const atFloor = { externalReference: 'paid-search', transactionAmount: 500, currencyId: 'BRL' }
    mockGetSubscription.mockResolvedValue({ ...authorizedSubscription, ...atFloor })
    expect(await load(loadArgs('?preapproval_id=sub-42') as never)).toEqual({
      state: 'confirmed',
      subscriptionId: 'sub-42',
    })
    const aboveFloor = { externalReference: 'meta-ads', transactionAmount: 1250, currencyId: 'BRL' }
    mockGetSubscription.mockResolvedValue({ ...authorizedSubscription, ...aboveFloor })
    expect(await load(loadArgs('?preapproval_id=sub-42') as never)).toEqual({
      state: 'confirmed',
      subscriptionId: 'sub-42',
    })
    const belowFloor = { externalReference: 'paid-search', transactionAmount: 499, currencyId: 'BRL' }
    mockGetSubscription.mockResolvedValue({ ...authorizedSubscription, ...belowFloor })
    expect(await load(loadArgs('?preapproval_id=sub-42') as never)).toEqual({
      state: 'error',
      kind: 'subscription',
    })
  })

  it('reserves pending for statuses that can still progress', async () => {
    mockGetSubscription.mockResolvedValue({ ...authorizedSubscription, status: 'pending' })
    expect(await load(loadArgs('?preapproval_id=sub-42') as never)).toEqual({
      state: 'pending',
      subscriptionId: 'sub-42',
    })
  })

  it('reports terminal paused/cancelled statuses distinctly instead of pending', async () => {
    // A paused or cancelled subscription will never progress to authorization,
    // so the page must not claim it is 'still being processed'.
    for (const status of ['paused', 'cancelled']) {
      mockGetSubscription.mockResolvedValue({ ...authorizedSubscription, status })
      expect(await load(loadArgs('?preapproval_id=sub-42') as never)).toEqual({
        state: 'cancelled',
        subscriptionId: 'sub-42',
      })
    }
  })

  it('renders the error state (loudly) when verification fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mockGetSubscription.mockRejectedValue(new MercadoPagoError('unauthorized', 'x'))
      expect(await load(loadArgs('?preapproval_id=sub-42') as never)).toEqual({
        state: 'error',
        kind: 'subscription',
      })
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('completion verification failed: unauthorized'),
      )
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('renders the error state when the preapproval is not found', async () => {
    mockGetSubscription.mockResolvedValue(undefined)
    expect(await load(loadArgs('?preapproval_id=nope') as never)).toEqual({
      state: 'error',
      kind: 'subscription',
    })
  })

  describe('abuse protection', () => {
    it('rejects malformed preapproval identifiers before touching the API', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        for (const bad of ['a b', 'id with spaces', 'x'.repeat(200), '<script>', 'id/../etc']) {
          expect(await load(loadArgs(`?preapproval_id=${encodeURIComponent(bad)}`) as never)).toEqual({
            state: 'error',
            kind: 'subscription',
          })
        }
        expect(mockGetSubscription).not.toHaveBeenCalled()
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('malformed preapproval_id'),
        )
      } finally {
        warnSpy.mockRestore()
      }
    })

    it('does not let a flood of malformed ids consume the rate-limit budget', async () => {
      // Shape check runs before the throttle, so junk never counts against
      // the window: after exceeding the window with malformed ids, a valid
      // request from the same IP is still allowed.
      mockGetSubscription.mockResolvedValue(authorizedSubscription)
      for (let i = 0; i < 20; i++) {
        expect(await load(loadArgs('?preapproval_id=bad%20id') as never)).toEqual({
          state: 'error',
          kind: 'subscription',
        })
      }
      expect(await load(loadArgs('?preapproval_id=sub-42') as never)).toEqual({
        state: 'confirmed',
        subscriptionId: 'sub-42',
      })
      expect(mockGetSubscription).toHaveBeenCalledTimes(1)
    })

    it('accepts legitimate identifier shapes', () => {
      // Hex-shaped ids (as seen in Mercado Pago responses) and short ids both pass.
      expect(isValidPreapprovalId('2c9380848b6e4d3a018b7041a2e6158c')).toBe(true)
      expect(isValidPreapprovalId('sub-42')).toBe(true)
      expect(isValidPreapprovalId('1234567890')).toBe(true)
    })

    it('throttles repeated verification requests from the same IP', async () => {
      mockGetSubscription.mockResolvedValue(authorizedSubscription)
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        // Window is 10 requests per minute; the 11th from the same IP is
        // refused without calling Mercado Pago again.
        for (let i = 0; i < 10; i++) {
          expect(await load(loadArgs('?preapproval_id=sub-42') as never)).toEqual({
            state: 'confirmed',
            subscriptionId: 'sub-42',
          })
        }
        expect(await load(loadArgs('?preapproval_id=sub-42') as never)).toEqual({
          state: 'rate_limited',
          kind: 'subscription',
        })
        expect(mockGetSubscription).toHaveBeenCalledTimes(10)
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('rate limit exceeded'),
        )
      } finally {
        warnSpy.mockRestore()
      }
    })

    it('fails loud instead of pooling unidentified clients when no IP resolves', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        const args = {
          url: urlFor('?preapproval_id=sub-42'),
          request: new Request('https://example.com/pt-br/checkout/complete/?preapproval_id=sub-42'),
          getClientAddress: (): string => {
            throw new Error('adapter provides no client address')
          },
        }
        expect(await load(args as never)).toEqual({ state: 'error', kind: 'subscription' })
        expect(mockGetSubscription).not.toHaveBeenCalled()
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('cannot determine client IP'),
        )
      } finally {
        errorSpy.mockRestore()
      }
    })
  })
})

describe('checkout/complete load — one-time payments (Checkout Pro)', () => {
  beforeEach(() => {
    mockGetPayment.mockReset()
    resetRateLimitBuckets()
  })

  const approvedPayment = {
    id: '1234567890',
    status: 'approved',
    statusDetail: 'accredited',
    externalReference: 'website-build:website:new',
    transactionAmount: 3000,
    currencyId: 'BRL',
  }

  it('reports missing when the redirect carries neither preapproval_id nor payment_id', async () => {
    expect(await load(loadArgs('') as never)).toEqual({ state: 'missing' })
    expect(mockGetPayment).not.toHaveBeenCalled()
    expect(mockGetSubscription).not.toHaveBeenCalled()
  })

  it('confirms only an approved payment and surfaces the reference', async () => {
    mockGetPayment.mockResolvedValue(approvedPayment)
    expect(await load(loadArgs('?payment_id=1234567890') as never)).toEqual({
      state: 'payment_confirmed',
      paymentId: '1234567890',
    })
    expect(mockGetPayment).toHaveBeenCalledWith('1234567890')
  })

  it('accepts the legacy collection_id parameter for one-time checkouts', async () => {
    mockGetPayment.mockResolvedValue(approvedPayment)
    expect(await load(loadArgs('?collection_id=1234567890') as never)).toEqual({
      state: 'payment_confirmed',
      paymentId: '1234567890',
    })
  })

  it('never claims a website-build success for an approved payment bound to another product', async () => {
    // An approved payment whose external_reference/amount/currency do not match
    // a server-created website-build checkout must not show the success claim.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const mismatches = [
        { externalReference: 'unrelated:product:1', transactionAmount: 3000, currencyId: 'BRL' },
        { externalReference: 'website-build:website:new', transactionAmount: 2999, currencyId: 'BRL' },
        { externalReference: 'website-build:website:new', transactionAmount: 3000, currencyId: 'USD' },
        { externalReference: null, transactionAmount: 3000, currencyId: 'BRL' },
      ]
      for (const patch of mismatches) {
        mockGetPayment.mockResolvedValue({ ...approvedPayment, ...patch })
        expect(await load(loadArgs('?payment_id=1234567890') as never)).toEqual({
          state: 'error',
          kind: 'payment',
        })
      }
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('does not match a server-created website build'))
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('confirms every server-created build price/kind combination', async () => {
    const combos = [
      { externalReference: 'website-build:website:new', transactionAmount: 3000 },
      { externalReference: 'website-build:website:migration', transactionAmount: 6000 },
      { externalReference: 'website-build:ecommerce:new', transactionAmount: 6000 },
      { externalReference: 'website-build:ecommerce:migration', transactionAmount: 12000 },
    ]
    for (const patch of combos) {
      mockGetPayment.mockResolvedValue({ ...approvedPayment, ...patch })
      expect(await load(loadArgs('?payment_id=1234567890') as never)).toEqual({
        state: 'payment_confirmed',
        paymentId: '1234567890',
      })
    }
  })

  it('never claims success for a payment Mercado Pago has not approved', async () => {
    for (const status of ['rejected', 'refunded', 'cancelled', 'charged_back']) {
      mockGetPayment.mockResolvedValue({ ...approvedPayment, status })
      expect(await load(loadArgs('?payment_id=1234567890') as never)).toEqual({
        state: 'payment_unconfirmed',
        paymentId: '1234567890',
      })
    }
  })

  it('shows a pending state for asynchronous payments still awaiting confirmation', async () => {
    // Boleto and Pix can legitimately redirect with pending/in_process; that
    // is not a failure and must not be labeled 'não foi concluído'.
    for (const status of ['pending', 'in_process']) {
      mockGetPayment.mockResolvedValue({ ...approvedPayment, status })
      expect(await load(loadArgs('?payment_id=1234567890') as never)).toEqual({
        state: 'payment_pending',
        paymentId: '1234567890',
      })
    }
  })

  it('never labels a pending payment bound to another product as this site’s purchase', async () => {
    // The pending branch must apply the same binding rule as the approved
    // branch: a pending payment for a different external_reference/amount/
    // currency is not this checkout and must not promise website development.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const mismatches = [
        { externalReference: 'unrelated:product:1', status: 'pending' },
        { externalReference: 'website-build:website:new', transactionAmount: 2999, status: 'in_process' },
        { externalReference: 'website-build:website:new', currencyId: 'USD', status: 'pending' },
        { externalReference: null, status: 'pending' },
      ]
      for (const patch of mismatches) {
        mockGetPayment.mockResolvedValue({ ...approvedPayment, ...patch })
        expect(await load(loadArgs('?payment_id=1234567890') as never)).toEqual({
          state: 'error',
          kind: 'payment',
        })
      }
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('does not match a server-created website build'))
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('renders the error state (loudly) when payment verification fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mockGetPayment.mockRejectedValue(new MercadoPagoError('unauthorized', 'x'))
      expect(await load(loadArgs('?payment_id=1234567890') as never)).toEqual({
        state: 'error',
        kind: 'payment',
      })
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('payment verification failed: unauthorized'),
      )
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('renders the error state when the payment is not found', async () => {
    mockGetPayment.mockResolvedValue(undefined)
    expect(await load(loadArgs('?payment_id=nope') as never)).toEqual({
      state: 'error',
      kind: 'payment',
    })
  })

  it('rejects malformed payment ids before touching the API', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      for (const bad of ['a b', 'id with spaces', 'x'.repeat(200), '<script>', 'id/../etc']) {
        expect(await load(loadArgs(`?payment_id=${encodeURIComponent(bad)}`) as never)).toEqual({
          state: 'error',
          kind: 'payment',
        })
      }
      expect(mockGetPayment).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('malformed payment_id'))
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('throttles repeated payment verification requests from the same IP', async () => {
    mockGetPayment.mockResolvedValue(approvedPayment)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      for (let i = 0; i < 10; i++) {
        expect(await load(loadArgs('?payment_id=1234567890') as never)).toEqual({
          state: 'payment_confirmed',
          paymentId: '1234567890',
        })
      }
      expect(await load(loadArgs('?payment_id=1234567890') as never)).toEqual({
        state: 'rate_limited',
        kind: 'payment',
      })
      expect(mockGetPayment).toHaveBeenCalledTimes(10)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('rate limit exceeded'))
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('does not let a flood of malformed ids consume the payment rate-limit budget', async () => {
    mockGetPayment.mockResolvedValue(approvedPayment)
    for (let i = 0; i < 20; i++) {
      expect(await load(loadArgs('?payment_id=bad%20id') as never)).toEqual({
        state: 'error',
        kind: 'payment',
      })
    }
    expect(await load(loadArgs('?payment_id=1234567890') as never)).toEqual({
      state: 'payment_confirmed',
      paymentId: '1234567890',
    })
    expect(mockGetPayment).toHaveBeenCalledTimes(1)
  })

  it('accepts legitimate payment id shapes', () => {
    expect(isValidPaymentId('1234567890')).toBe(true)
    expect(isValidPaymentId('2c9380848b6e4d3a018b7041a2e6158c')).toBe(true)
    expect(isValidPaymentId('')).toBe(false)
    expect(isValidPaymentId('a b')).toBe(false)
  })
})
