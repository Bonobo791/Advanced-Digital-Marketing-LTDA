import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureAttribution, parseAttribution, sanitizeAttribution } from './attribution'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('parseAttribution', () => {
  it('extracts UTM and click-id parameters from a URL', () => {
    const url = new URL(
      'https://example.com/landing?utm_source=google&utm_medium=cpc&utm_campaign=summer&utm_content=ad1&utm_term=seo&gclid=g1&gbraid=gb1&wbraid=wb1&fbclid=f1',
    )
    expect(parseAttribution(url)).toEqual({
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'summer',
      utmContent: 'ad1',
      utmTerm: 'seo',
      gclid: 'g1',
      gbraid: 'gb1',
      wbraid: 'wb1',
      fbclid: 'f1',
    })
  })

  it('returns an empty object when no attribution parameters are present', () => {
    expect(parseAttribution(new URL('https://example.com/plain'))).toEqual({})
  })
})

describe('sanitizeAttribution', () => {
  it('accepts a server-shaped attribution payload', () => {
    const attribution = sanitizeAttribution({
      utm_source: 'meta',
      gclid: 'x'.repeat(600),
      landingPage: '/contact',
      referrer: 'https://google.com',
      ignored: 'junk',
    })
    expect(attribution).toEqual({
      utmSource: 'meta',
      gclid: 'x'.repeat(512),
      landingPage: '/contact',
      referrer: 'https://google.com',
    })
  })

  it('accepts camelCase keys too', () => {
    expect(sanitizeAttribution({ utmCampaign: 'spring' })).toEqual({ utmCampaign: 'spring' })
  })

  it('returns undefined for junk or empty payloads', () => {
    expect(sanitizeAttribution(null)).toBeUndefined()
    expect(sanitizeAttribution('nope')).toBeUndefined()
    expect(sanitizeAttribution({})).toBeUndefined()
    expect(sanitizeAttribution({ utm_source: '   ' })).toBeUndefined()
  })
})

describe('captureAttribution — loud persistence failures', () => {
  function stubBrowser(storage: {
    getItem: () => string | null
    setItem: () => void
  }): void {
    vi.stubGlobal('window', { location: { href: 'https://example.com/landing?utm_source=google' } })
    vi.stubGlobal('document', { referrer: 'https://google.com/' })
    vi.stubGlobal('localStorage', { ...storage, removeItem: () => {} })
  }

  it('warns loudly when the first-touch write cannot be persisted', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubBrowser({
      getItem: () => null,
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError')
      },
    })

    captureAttribution()

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[attribution]'))
    expect(warn.mock.calls[0][0]).toContain('not persisted')
  })

  it('warns loudly when the stored attribution cannot be read', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubBrowser({
      getItem: () => {
        throw new DOMException('denied', 'SecurityError')
      },
      setItem: () => {},
    })

    const result = captureAttribution()

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('getItem failed'))
    // The capture still returns the in-memory attribution for the caller.
    expect(result?.utmSource).toBe('google')
  })

  it('persists and stays silent on the happy path', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const setItem = vi.fn()
    stubBrowser({ getItem: () => null, setItem })

    captureAttribution()

    expect(setItem).toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })
})
