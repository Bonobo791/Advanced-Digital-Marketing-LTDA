import { describe, expect, it, vi } from 'vitest'
import locale from '../../netlify/edge-functions/locale'

const edgeContext = ({ language, country }: { language?: string; country?: string } = {}) => {
  const cookies = {
    get: vi.fn(() => language),
    set: vi.fn(),
    delete: vi.fn(),
  }
  const next = vi.fn(() => new Response('next'))

  return { context: { cookies, geo: { country: country ? { code: country } : undefined }, next }, cookies, next }
}

describe('Netlify locale edge function', () => {
  it('returns a private temporary redirect for a first-time Brazilian homepage visit', async () => {
    const { context } = edgeContext({ country: 'BR' })

    const response = await locale(new Request('https://example.com/?utm_source=campaign'), context)

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('https://example.com/pt-br/?utm_source=campaign')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it('sets only the Brazilian suggestion flag on English deep pages', async () => {
    const { context, cookies, next } = edgeContext({ country: 'BR' })

    const response = await locale(new Request('https://example.com/about/'), context)

    expect(await response.text()).toBe('next')
    expect(next).toHaveBeenCalledOnce()
    expect(cookies.set).toHaveBeenCalledWith({ name: 'geo_br', value: '1', path: '/', sameSite: 'lax', secure: true })
  })
})
