import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyticsReferrer, isSensitiveAnalyticsUrl } from './analytics-privacy'

afterEach(() => vi.restoreAllMocks())

describe('analytics URL policy', () => {
  it.each(['/contact-notes/', '/pt-br/contato-notes/', '/services/contact/', '/about/?utm_source=synthetic', '/checkout/complete/'])('preserves safe route %s', (path) => {
    expect(isSensitiveAnalyticsUrl(new URL(path, 'https://example.test'))).toBe(false)
  })

  it.each(['/CONTACT/', '/pt-br/CONTATO/', '/about/?TOKEN=', '/about/?%74oken=synthetic.token', '/contact/verify/future/'])('excludes sensitive variant %s', (path) => {
    expect(isSensitiveAnalyticsUrl(new URL(path, 'https://example.test'))).toBe(true)
  })

  it('fails closed on malformed encoded paths without logging the URL', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(isSensitiveAnalyticsUrl(new URL('https://example.test/%E0%A4%A?synthetic=private'))).toBe(true)
    expect(warn).toHaveBeenCalledWith('[analytics] malformed pathname; analytics disabled')
  })
})

describe('analytics referrer policy', () => {
  it('keeps empty referrers empty', () => {
    expect(analyticsReferrer('')).toBe('')
  })

  it('omits invalid referrers without logging their contents', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(analyticsReferrer('synthetic-private-value')).toBe('')
    expect(warn).toHaveBeenCalledWith('[analytics] invalid referrer; referrer omitted')
  })

  it('removes encoded contact referrers', () => {
    expect(analyticsReferrer('https://example.test/%63ontact/verify/?token=synthetic.token')).toBe('')
  })

  it('removes query, fragment, and userinfo from ordinary referrers', () => {
    expect(analyticsReferrer('https://synthetic:synthetic@example.test/services/?subject=synthetic#synthetic')).toBe('https://example.test/services/')
  })
})
