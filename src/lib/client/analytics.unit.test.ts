import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireBeginCheckout, firePurchase, initializeAnalytics, protectAnalyticsNavigation } from './analytics'
import type { NavigationTarget } from '@sveltejs/kit'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const items = [{ item_id: 'synthetic-service', item_name: 'Synthetic service' }]

describe('checkout analytics privacy', () => {
  it.each(['/contact/', '/contact/verify/?token=synthetic.token', '/pt-br/contato/verificar/?token=synthetic.token', '/about/?token=synthetic.token'])('does not enqueue checkout events on %s even if a dataLayer exists', (path) => {
    const layer: unknown[] = []
    vi.stubGlobal('window', { location: { href: `https://example.test${path}` }, dataLayer: layer })
    vi.spyOn(console, 'info').mockImplementation(() => {})

    fireBeginCheckout(items, 100)
    const accepted = firePurchase({ orderId: 'synthetic-order', value: 100, currency: 'USD', items })

    expect(accepted).toBe(false)
    expect(layer).toEqual([])
  })

  it('preserves checkout events on ordinary service and return pages', () => {
    const layer: unknown[] = []
    vi.stubGlobal('window', { location: { href: 'https://example.test/checkout/complete/' }, dataLayer: layer })

    fireBeginCheckout(items, 100)
    expect(firePurchase({ orderId: 'synthetic-order', value: 100, currency: 'USD', items })).toBe(true)
    expect(layer).toEqual([
      { event: 'begin_checkout', currency: 'BRL', value: 100, items },
      { event: 'purchase', currency: 'USD', value: 100, transaction_id: 'synthetic-order', items },
    ])
  })
})

// An inert document keeps all unit-test script creation offline.
function target(url: URL): NavigationTarget {
  return { url, params: {}, route: { id: null }, scroll: null }
}

function stubDocument(path: string, referrer = '') {
  const scripts: { id?: string; src?: string; async?: boolean; referrerPolicy?: string }[] = []
  const browser = { location: { href: `https://example.test${path}`, assign: vi.fn() }, dataLayer: undefined as unknown[] | undefined }
  vi.stubGlobal('window', browser)
  vi.stubGlobal('document', {
    referrer,
    getElementById: (id: string) => scripts.find((script) => script.id === id),
    createElement: () => ({}),
    head: { appendChild: (script: typeof scripts[number]) => scripts.push(script) },
  })
  return { browser, scripts }
}

describe('analytics initialization', () => {
  it.each(['/contact', '/contact/verify', '/pt-br/contato/', '/pt-br/contato/verificar/?token=synthetic.token', '/%63ontact/verify/', '/pt-br/%63ontato/verificar/', '/about/?%74oken=synthetic.token'])('does not create a tag or dataLayer on %s', (path) => {
    const { scripts, browser } = stubDocument(path)
    expect(initializeAnalytics()).toBe(false)
    expect(scripts).toEqual([])
    expect(browser.dataLayer).toBeUndefined()
  })

  it('configures safe-route tracking once with a sanitized referrer before loading the tag', () => {
    const { scripts, browser } = stubDocument('/services/?utm_source=synthetic', 'https://search.example/results/?q=synthetic#section')
    expect(initializeAnalytics()).toBe(true)
    expect(initializeAnalytics()).toBe(true)
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toBe('https://www.googletagmanager.com/gtag/js?id=G-ZREVRSHYJA')
    expect(scripts[0].referrerPolicy).toBe('no-referrer')
    const commands = browser.dataLayer?.map((command) => Array.from(command as ArrayLike<unknown>))
    expect(commands?.[0]?.[0]).toBe('js')
    expect(commands?.[1]).toEqual(['config', 'G-ZREVRSHYJA', { page_referrer: 'https://search.example/results/' }])
  })

  it.each(['https://example.test/contact/verify/?token=synthetic.token', 'https://example.test/pt-br/contato/verificar/?token=synthetic.token', 'https://example.test/about/?token=synthetic.token'])('never copies a sensitive referrer %s into config', (referrer) => {
    const { browser } = stubDocument('/services/', referrer)
    expect(initializeAnalytics()).toBe(true)
    const config = Array.from(browser.dataLayer?.[1] as ArrayLike<unknown>)
    expect(config[2]).toEqual({ page_referrer: '' })
  })

  it('is inert during SSR', () => {
    vi.stubGlobal('window', undefined)
    expect(initializeAnalytics()).toBe(false)
  })
})

describe('analytics navigation isolation', () => {
  it.each([
    ['/services/', '/contact/verify/?token=synthetic.token'],
    ['/contact/verify/?token=synthetic.token', '/services/'],
    ['/pt-br/contato/', '/pt-br/servicos/'],
    ['/about/', '/about/?token=synthetic.token'],
  ])('replaces SPA navigation from %s to %s with a document navigation', (from, to) => {
    const { browser } = stubDocument(from)
    const cancel = vi.fn()
    const targetUrl = target(new URL(to, 'https://example.test'))
    protectAnalyticsNavigation({ from: target(new URL(browser.location.href)), to: targetUrl, willUnload: false, cancel })
    expect(cancel).toHaveBeenCalledOnce()
    expect(browser.location.assign).toHaveBeenCalledWith(targetUrl.url.href)
  })

  it('keeps safe-route SPA navigation intact', () => {
    const { browser } = stubDocument('/services/')
    const cancel = vi.fn()
    protectAnalyticsNavigation({ from: target(new URL(browser.location.href)), to: target(new URL('https://example.test/about/')), willUnload: false, cancel })
    expect(cancel).not.toHaveBeenCalled()
    expect(browser.location.assign).not.toHaveBeenCalled()
  })

  it('does not cancel native document navigations or window closing', () => {
    const { browser } = stubDocument('/contact/')
    const cancel = vi.fn()
    protectAnalyticsNavigation({ from: target(new URL(browser.location.href)), to: target(new URL('https://example.test/services/')), willUnload: true, cancel })
    protectAnalyticsNavigation({ from: target(new URL(browser.location.href)), to: null, willUnload: true, cancel })
    expect(cancel).not.toHaveBeenCalled()
    expect(browser.location.assign).not.toHaveBeenCalled()
  })
})
