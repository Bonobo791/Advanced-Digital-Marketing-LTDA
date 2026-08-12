import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { load } from './+page.server'
import { isValidPreapprovalId } from '$lib/server/checkout'
import { MercadoPagoError, getSubscription } from '$lib/server/mercadoPago'
import { resetRateLimitBuckets } from '$lib/server/rate-limit'

vi.mock('$lib/server/mercadoPago', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/server/mercadoPago')>()
  return { ...actual, getSubscription: vi.fn() }
})

const mockGetSubscription = vi.mocked(getSubscription)

const urlFor = (query: string) =>
  new URL(`https://example.com/pt-br/checkout/complete/${query}`)

/** Minimal load event; getClientAddress defaults to a stable test IP. */
const loadArgs = (query: string, ip = '203.0.113.9') => ({
  url: urlFor(query),
  request: new Request(`https://example.com/pt-br/checkout/complete/${query}`),
  getClientAddress: (): string => ip,
})

const authorizedSubscription = {
  id: 'sub-42',
  status: 'authorized',
  reason: null,
  externalReference: null,
  payerEmail: null,
  transactionAmount: null,
  currencyId: null,
}

describe('checkout/complete load', () => {
  beforeEach(() => {
    mockGetSubscription.mockReset()
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

  it('never claims success for a non-authorized status', async () => {
    for (const status of ['pending', 'paused', 'cancelled']) {
      mockGetSubscription.mockResolvedValue({ ...authorizedSubscription, status })
      expect(await load(loadArgs('?preapproval_id=sub-42') as never)).toEqual({
        state: 'pending',
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
    })
  })

  describe('abuse protection', () => {
    it('rejects malformed preapproval identifiers before touching the API', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        for (const bad of ['a b', 'id with spaces', 'x'.repeat(200), '<script>', 'id/../etc']) {
          expect(await load(loadArgs(`?preapproval_id=${encodeURIComponent(bad)}`) as never)).toEqual({
            state: 'error',
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
        expect(await load(args as never)).toEqual({ state: 'error' })
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
