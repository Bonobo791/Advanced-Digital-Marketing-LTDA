import { describe, expect, it } from 'vitest'
import { decideLocaleRequest, localeForPath, localizedPath } from './locale'

describe('locale routes', () => {
  it('maps every existing public page to its Brazilian Portuguese counterpart', () => {
    expect(localizedPath('/', 'pt-BR')).toBe('/pt-br/')
    expect(localizedPath('/about/', 'pt-BR')).toBe('/pt-br/sobre/')
    expect(localizedPath('/pt-br/contato/', 'en-US')).toBe('/contact/')
    expect(localeForPath('/pt-br/sobre/')).toBe('pt-BR')
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

  it('redirects a first-time Brazilian homepage visitor temporarily', () => {
    expect(
      decideLocaleRequest({ method: 'GET', pathname: '/', search: '', country: 'BR' }),
    ).toEqual({ type: 'redirect', location: '/pt-br/' })
  })

  it('keeps explicit localized URLs, English preferences, and non-navigation requests untouched', () => {
    expect(
      decideLocaleRequest({ method: 'GET', pathname: '/pt-br/sobre/', search: '', language: 'en-US', country: 'BR' }),
    ).toEqual({ type: 'next' })
    expect(
      decideLocaleRequest({ method: 'GET', pathname: '/', search: '', language: 'en-US', country: 'BR' }),
    ).toEqual({ type: 'next' })
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
})
