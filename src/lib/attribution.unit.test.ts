import { describe, expect, it } from 'vitest'
import { parseAttribution, sanitizeAttribution } from './attribution'

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
