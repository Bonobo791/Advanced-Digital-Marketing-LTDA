import { describe, expect, it } from 'vitest'
import { absoluteUrl, decideLocaleRequest, isCheckoutPath, LOCALE_ROUTES, localeForPath, localizedPath } from './locale'

describe('locale routes', () => {
  it('maps every existing public page to its Brazilian Portuguese counterpart', () => {
    expect(localizedPath('/', 'pt-BR')).toBe('/pt-br/')
    expect(localizedPath('/about/', 'pt-BR')).toBe('/pt-br/sobre/')
    expect(localizedPath('/pt-br/contato/', 'en-US')).toBe('/contact/')
    expect(localeForPath('/pt-br/sobre/')).toBe('pt-BR')
    expect(absoluteUrl(LOCALE_ROUTES.home['en-US'])).toBe('https://advanceddigitalmarketingltda.com/')
    expect(absoluteUrl(LOCALE_ROUTES.home['pt-BR'])).toBe('https://advanceddigitalmarketingltda.com/pt-br/')
  })

  it('converts service index paths between locales', () => {
    expect(localizedPath('/services/', 'pt-BR')).toBe('/pt-br/servicos/')
    expect(localizedPath('/pt-br/servicos/', 'en-US')).toBe('/services/')
  })

  it('converts service detail paths between locales', () => {
    expect(localizedPath('/services/paid-search/', 'pt-BR')).toBe('/pt-br/servicos/paid-search/')
    expect(localizedPath('/pt-br/servicos/paid-search/', 'en-US')).toBe('/services/paid-search/')
    expect(localizedPath('/pt-br/servicos/technical-seo/', 'en-US')).toBe('/services/technical-seo/')
  })

  it('flags checkout routes so the language switcher can hide on them', () => {
    expect(isCheckoutPath('/pt-br/checkout/complete/')).toBe(true)
    expect(isCheckoutPath('/pt-br/checkout/complete?preapproval_id=123')).toBe(true)
    expect(isCheckoutPath('/')).toBe(false)
    expect(isCheckoutPath('/pt-br/')).toBe(false)
    expect(isCheckoutPath('/pt-br/contato/')).toBe(false)
    expect(isCheckoutPath('/services/paid-search/')).toBe(false)
  })
})

describe('homepage locale decisions', () => {
  it('honors a Portuguese preference on the homepage and keeps tracking parameters', () => {
    expect(
      decideLocaleRequest({
        method: 'GET',
        pathname: '/',
        search: '?utm_source=campaign',
        language: 'pt-BR',
        country: 'US',
      }),
    ).toEqual({ type: 'redirect', location: '/pt-br/?utm_source=campaign' })
  })

  it('keeps a first-time Brazilian homepage visit on the canonical English URL and enables the suggestion', () => {
    expect(
      decideLocaleRequest({ method: 'GET', pathname: '/', search: '', country: 'BR' }),
    ).toEqual({ type: 'next', geoBr: true })
  })

  it('keeps explicit localized URLs, English preferences, and non-navigation requests untouched', () => {
    expect(
      decideLocaleRequest({ method: 'GET', pathname: '/pt-br/sobre/', search: '', language: 'en-US', country: 'BR' }),
    ).toEqual({ type: 'next' })
    expect(
      decideLocaleRequest({ method: 'GET', pathname: '/', search: '', language: 'en-US', country: 'BR' }),
    ).toEqual({ type: 'next', geoBr: false })
    expect(
      decideLocaleRequest({ method: 'POST', pathname: '/', search: '', country: 'BR' }),
    ).toEqual({ type: 'next' })
  })

  it('never redirects an English deep link and reports only its Brazilian suggestion signal', () => {
    expect(
      decideLocaleRequest({ method: 'GET', pathname: '/about/', search: '', language: 'pt-BR', country: 'BR' }),
    ).toEqual({ type: 'next', geoBr: true })
    expect(
      decideLocaleRequest({ method: 'GET', pathname: '/contact/', search: '', country: 'US' }),
    ).toEqual({ type: 'next', geoBr: false })
  })

  it('reports the Brazilian suggestion signal on service routes too', () => {
    // Service detail pages and the gateway indexes are non-home pages: a
    // Brazilian visitor lands on them with a geo_br signal, no redirect.
    expect(
      decideLocaleRequest({ method: 'GET', pathname: '/services/paid-search/', search: '', country: 'BR' }),
    ).toEqual({ type: 'next', geoBr: true })
    expect(
      decideLocaleRequest({ method: 'GET', pathname: '/services/', search: '', country: 'BR' }),
    ).toEqual({ type: 'next', geoBr: true })
    expect(
      decideLocaleRequest({ method: 'GET', pathname: '/pt-br/servicos/technical-seo/', search: '', country: 'US' }),
    ).toEqual({ type: 'next' })
  })
})
