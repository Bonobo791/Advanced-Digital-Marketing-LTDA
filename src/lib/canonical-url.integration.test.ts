import { describe, expect, it } from 'vitest'
import { render } from 'svelte/server'
import fc from 'fast-check'
import CanonicalHead from './components/chrome/CanonicalHead.svelte'
import { canonicalUrl } from './canonical-url'
import { LOCALE_ROUTES, SERVICES_INDEX_ROUTES, SITE_ORIGIN } from './locale'
import { SERVICE_ROUTES } from './services'

const pagePaths = [
  ...Object.values(LOCALE_ROUTES).flatMap(Object.values),
  ...Object.values(SERVICES_INDEX_ROUTES),
  ...Object.values(SERVICE_ROUTES).flatMap(Object.values),
  '/blog/',
  '/blog/chatgpt-ads-complete-guide-august-2026/',
  '/contact/verify/',
  '/pt-br/contato/verificar/',
  '/checkout/complete/',
  '/pt-br/checkout/complete/',
]

describe('shared page canonical metadata', () => {
  it.each(pagePaths)('renders exactly one canonical for %s on the production origin', (pathname) => {
    const { head } = render(CanonicalHead, { props: { pathname, status: 200 } })
    expect(head.match(/rel="canonical"/g)).toHaveLength(1)
    expect(head).toContain(`href="${SITE_ORIGIN}${pathname}"`)
    expect(head).toContain(`property="og:url" content="${SITE_ORIGIN}${pathname}"`)
  })

  it.each([
    ['/contact/?subject=Technical%20SEO', '/contact/'],
    ['/contact/?subject=Meta+audit+request#form', '/contact/'],
    ['/pt-br/contato/?subject=AI+automation+quote+request', '/pt-br/contato/'],
    ['/contact/verify/?token=private-token', '/contact/verify/'],
    ['/checkout/complete/?session_id=private-session', '/checkout/complete/'],
    ['/pt-br/checkout/complete/?payment_id=private-payment', '/pt-br/checkout/complete/'],
    ['/services/technical-seo?preselect=seo-content#subscribe', '/services/technical-seo/'],
  ])('excludes request context from %s', (requestPath, expectedPath) => {
    const { head } = render(CanonicalHead, { props: { pathname: requestPath, status: 200 } })
    expect(head).toContain(`href="${SITE_ORIGIN}${expectedPath}"`)
    expect(head).not.toContain('?')
    expect(head).not.toContain('#')
  })

  it('keeps every page identity unchanged for arbitrary query and fragment values', () => {
    fc.assert(fc.property(fc.constantFrom(...pagePaths), fc.string(), fc.string(), (path, query, fragment) => {
      expect(canonicalUrl(`${path}?subject=${encodeURIComponent(query)}#${encodeURIComponent(fragment)}`))
        .toBe(`${SITE_ORIGIN}${path}`)
    }))
  })

  it.each([400, 404, 500])('omits canonical and Open Graph URL on HTTP %s errors', (status) => {
    const { head } = render(CanonicalHead, { props: { pathname: '/missing/', status } })
    expect(head).not.toContain('rel="canonical"')
    expect(head).not.toContain('property="og:url"')
  })

  it.each(['https://other.example/contact/', '//other.example/contact/', '/\\other.example/contact/', '/\t/other.example/contact/'])
    ('rejects a path that could switch hosts: %s', (path) => {
      expect(() => canonicalUrl(path)).toThrow('root-relative page path')
    })
})
