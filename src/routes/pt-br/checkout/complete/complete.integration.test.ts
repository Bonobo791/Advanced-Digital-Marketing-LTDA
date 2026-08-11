import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { load } from './+page.server'
import { MercadoPagoError, getSubscription } from '$lib/server/mercadoPago'

vi.mock('$lib/server/mercadoPago', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/server/mercadoPago')>()
  return { ...actual, getSubscription: vi.fn() }
})

const mockGetSubscription = vi.mocked(getSubscription)

const urlFor = (query: string) =>
  new URL(`https://example.com/pt-br/checkout/complete/${query}`)

describe('checkout/complete load', () => {
  beforeEach(() => {
    mockGetSubscription.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('reports missing when the redirect carries no preapproval_id', async () => {
    expect(await load({ url: urlFor('') } as never)).toEqual({ state: 'missing' })
    expect(mockGetSubscription).not.toHaveBeenCalled()
  })

  it('confirms only an authorized preapproval and surfaces the reference', async () => {
    mockGetSubscription.mockResolvedValue({
      id: 'sub-42',
      status: 'authorized',
      reason: null,
      externalReference: null,
      payerEmail: null,
      transactionAmount: null,
      currencyId: null,
    })
    expect(await load({ url: urlFor('?preapproval_id=sub-42') } as never)).toEqual({
      state: 'confirmed',
      subscriptionId: 'sub-42',
    })
    expect(mockGetSubscription).toHaveBeenCalledWith('sub-42')
  })

  it('never claims success for a non-authorized status', async () => {
    for (const status of ['pending', 'paused', 'cancelled']) {
      mockGetSubscription.mockResolvedValue({
        id: 'sub-42',
        status,
        reason: null,
        externalReference: null,
        payerEmail: null,
        transactionAmount: null,
        currencyId: null,
      })
      expect(await load({ url: urlFor('?preapproval_id=sub-42') } as never)).toEqual({
        state: 'pending',
        subscriptionId: 'sub-42',
      })
    }
  })

  it('renders the error state (loudly) when verification fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mockGetSubscription.mockRejectedValue(new MercadoPagoError('unauthorized', 'x'))
      expect(await load({ url: urlFor('?preapproval_id=sub-42') } as never)).toEqual({
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
    expect(await load({ url: urlFor('?preapproval_id=nope') } as never)).toEqual({
      state: 'error',
    })
  })
})
