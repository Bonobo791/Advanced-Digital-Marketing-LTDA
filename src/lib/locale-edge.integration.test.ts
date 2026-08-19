/**
 * Guards the locale decision that used to run at the Netlify edge
 * (netlify/edge-functions/locale.ts) and now runs in the SvelteKit `handle`
 * hook on the Coolify-hosted Node server (src/lib/locale-edge.ts): root
 * redirect for pt-BR language cookie, geo_br suggestion flag from CDN-forwarded
 * country headers, and the exact same path set as the edge config.
 */
import { describe, expect, it } from 'vitest'
import { applyLocaleEdge, geoCountryFromHeaders, isLocaleEdgePath } from './locale-edge'

describe('locale edge (server hooks port)', () => {
  it('keeps a first-time Brazilian homepage visit on the canonical URL and flags the suggestion', () => {
    const result = applyLocaleEdge(new Request('https://example.com/?utm_source=campaign'), undefined, 'BR')
    expect(result).toEqual({ type: 'next', geoBr: true })
  })

  it('redirects root to /pt-br/ when the language cookie is pt-BR', () => {
    const result = applyLocaleEdge(new Request('https://example.com/'), 'pt-BR', undefined)
    expect(result).toEqual({ type: 'redirect', location: '/pt-br/' })
  })

  it('keeps the search string on the pt-BR redirect', () => {
    const result = applyLocaleEdge(new Request('https://example.com/?utm_source=newsletter'), 'pt-BR', undefined)
    expect(result).toEqual({ type: 'redirect', location: '/pt-br/?utm_source=newsletter' })
  })

  it('sets the suggestion flag only on English page paths', () => {
    expect(applyLocaleEdge(new Request('https://example.com/about/'), undefined, 'BR')).toEqual({
      type: 'next',
      geoBr: true,
    })
    expect(
      applyLocaleEdge(new Request('https://example.com/services/technical-seo/'), undefined, 'BR'),
    ).toEqual({ type: 'next', geoBr: true })
  })

  it('ignores non-page paths (API, assets)', () => {
    expect(applyLocaleEdge(new Request('https://example.com/api/health'), undefined, 'BR')).toEqual({
      type: 'next',
    })
    expect(
      applyLocaleEdge(new Request('https://example.com/_app/immutable/foo.js'), 'pt-BR', undefined),
    ).toEqual({ type: 'next' })
  })

  it('does not redirect or flag non-GET methods', () => {
    const post = new Request('https://example.com/', { method: 'POST' })
    expect(applyLocaleEdge(post, 'pt-BR', undefined)).toEqual({ type: 'next' })
  })

  it('matches the same path set as the Netlify edge config', () => {
    const page = ['/', '/about', '/about/', '/contact', '/contact/', '/services', '/services/', '/services/geo/', '/pt-br/servicos', '/pt-br/servicos/', '/pt-br/servicos/technical-seo/']
    for (const path of page) expect(isLocaleEdgePath(path), path).toBe(true)
    const other = ['/pt-br/', '/pt-br/sobre/', '/api/health', '/favicon.ico', '/_app/start.js']
    for (const path of other) expect(isLocaleEdgePath(path), path).toBe(false)
  })
})

describe('geoCountryFromHeaders', () => {
  it('reads the country from the standard forwarding headers in priority order', () => {
    expect(geoCountryFromHeaders(new Headers({ 'bunny-country': 'br' }))).toBe('BR')
    expect(geoCountryFromHeaders(new Headers({ 'X-Country-Code': 'us' }))).toBe('US')
    expect(geoCountryFromHeaders(new Headers({ 'CF-IPCountry': 'DE' }))).toBe('DE')
    expect(geoCountryFromHeaders(new Headers({ 'X-Geo-Country': 'jp' }))).toBe('JP')
    // First header present wins.
    expect(
      geoCountryFromHeaders(new Headers({ 'bunny-country': 'br', 'cf-ipcountry': 'US' })),
    ).toBe('BR')
  })

  it('returns undefined when no country header is present', () => {
    expect(geoCountryFromHeaders(new Headers())).toBeUndefined()
    expect(geoCountryFromHeaders(new Headers({ 'x-request-id': 'abc' }))).toBeUndefined()
  })
})
