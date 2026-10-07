import { describe, expect, it, vi } from 'vitest'
import { render } from 'svelte/server'
import TechnicalSeoRouteFixture from './test-utils/TechnicalSeoRouteFixture.svelte'
import { load as serverLoad } from '../routes/services/[slug]/+page.server'
import { load as pageLoad } from '../routes/services/[slug]/+page'

const state = vi.hoisted(() => ({ url: new URL('https://example.test/services/technical-seo/') }))
vi.mock('$app/state', () => ({ page: state }))
vi.mock('$app/environment', () => ({ browser: false }))

function documentFor(query = '') {
  state.url = new URL(`/services/technical-seo/${query}`, 'https://example.test')
  return render(TechnicalSeoRouteFixture, {
    props: { data: pageLoad({ params: { slug: 'technical-seo' }, data: serverLoad({ params: { slug: 'technical-seo' } }) }) },
  })
}

function text(html: string) {
  return html.replace(/<[^>]*>/g, '').replace(/<!--.*?-->/gs, '').replace(/\s+/g, ' ').trim()
}

function selectedServices(body: string) {
  return [...body.matchAll(/<label class="sub-check">(.*?)<\/label>/gs)]
    .filter(([, label]) => /<input[^>]*\schecked(?:[\s>]|=)/.test(label))
    .map(([, label]) => text(label.match(/<b>(.*?)<\/b>/s)?.[1] ?? ''))
}

function monthlyTotal(body: string) {
  return text(body.match(/<div class="sub-total"[^>]*>(.*?)<\/div>/s)?.[1] ?? '')
}

describe('English technical SEO page', () => {
  it('serves the approved headline, core sections, inline sources, and synthetic label in the initial HTML', () => {
    const { body } = documentFor()
    expect(text(body.match(/<h1[^>]*>(.*?)<\/h1>/s)?.[1] ?? '')).toBe('Technical SEO services with fixes you can verify')
    for (const heading of ['Summary', 'Key Takeaways', 'When technical SEO help is useful', 'What a scoped engagement can cover', 'Prioritized deliverables and reporting', 'Access, scope, and fees', 'Frequently asked questions', 'About the author']) {
      expect(body).toContain(heading)
    }
    expect(body).toContain('This is a synthetic demonstration.')
    expect(body).toContain('href="https://developers.google.com/search/docs/crawling-indexing/canonicalization"')
    expect(body).toContain('target="_blank"')
  })

  it('serves approved metadata while retaining canonical and language alternates', () => {
    const { head } = documentFor()
    expect(head).toContain('Technical SEO Services | Implementation and QA | ADM')
    expect(head).toContain('Identify crawl, rendering, indexing, template, and content-planning issues.')
    expect(head).toContain('rel="canonical" href="https://advanceddigitalmarketingltda.com/services/technical-seo/"')
    expect(head).toContain('hreflang="pt-BR"')
  })

  it('keeps the audit, current monthly prices, and checkout destinations', () => {
    const { body } = documentFor()
    expect(text(body)).toContain('The Audit')
    expect(body).toContain('Free')
    expect(body).toContain('$700')
    expect(body).toContain('$600')
    expect(body).toContain('href="?preselect=seo-content#subscribe"')
    expect(body).toContain('href="?preselect=backlinks#subscribe"')
    expect(body).toContain('id="subscribe"')
    expect(body).toContain('Subscribe with Stripe')
  })

  it.each([
    { id: 'seo-content', name: 'SEO Content', total: '$400.00' },
    { id: 'backlinks', name: 'Backlinks', total: '$600.00' },
  ])('selects only the requested recurring option $id', ({ id, name, total }) => {
    const { body } = documentFor(`?preselect=${id}#subscribe`)
    expect(selectedServices(body)).toEqual([name])
    expect(monthlyTotal(body)).toBe(`Monthly total ${total}/mo`)
  })

  it('uses the existing default package for an invalid preselect', () => {
    const { body } = documentFor('?preselect=invalid')
    expect(selectedServices(body)).toEqual(['SEO Content', 'Backlinks'])
    expect(monthlyTotal(body)).toBe('Monthly total $1,000.00/mo')
  })

  it.each(['geo', 'web-development', 'paid-search', 'meta-ads', 'ai-automation'])('keeps %s on its existing service layout', (slug) => {
    const data = pageLoad({ params: { slug }, data: serverLoad({ params: { slug } }) })
    expect(data.service).toBe(slug)
    expect(data.technicalSeo).toBeNull()
  })
})
