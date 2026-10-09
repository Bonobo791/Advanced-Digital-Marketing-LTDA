import { describe, expect, it, vi } from 'vitest'
import { render } from 'svelte/server'
import TechnicalSeoRouteFixture from './test-utils/TechnicalSeoRouteFixture.svelte'
import { load as serverLoad } from '../routes/services/[slug]/+page.server'
import { load as pageLoad } from '../routes/services/[slug]/+page'
import { load as portugueseServerLoad } from '../routes/pt-br/servicos/[slug]/+page.server'
import { load as portuguesePageLoad } from '../routes/pt-br/servicos/[slug]/+page'

const state = vi.hoisted(() => ({ url: new URL('https://example.test/services/technical-seo/') }))
vi.mock('$app/state', () => ({ page: state }))
vi.mock('$app/environment', () => ({ browser: false }))

describe('technical SEO route slug validation', () => {
  it.each(['en-US', 'pt-BR'] as const)('keeps unknown slugs out of the %s article and returns 404', (locale) => {
    const params = { slug: 'technical-seo-unknown' }
    const data = locale === 'en-US' ? serverLoad({ params }) : portugueseServerLoad({ params })
    expect(data.technicalSeo).toBeNull()
    const load = locale === 'en-US' ? pageLoad : portuguesePageLoad
    expect(() => load({ params, data })).toThrow(expect.objectContaining({ status: 404 }))
  })
})

function documentFor(query = '') {
  state.url = new URL(`/services/technical-seo/${query}`, 'https://example.test')
  return render(TechnicalSeoRouteFixture, {
    props: { data: pageLoad({ params: { slug: 'technical-seo' }, data: serverLoad({ params: { slug: 'technical-seo' } }) }) },
  })
}

function selectedServices(body: string) {
  return [...body.matchAll(/<label class="sub-check">(.*?)<\/label>/gs)]
    .filter(([, label]) => /<input[^>]*\schecked(?:[\s>]|=)/.test(label))
    .map(([, label]) => label.match(/<b>([^<]+)<\/b>/)?.[1])
}

function monthlyTotal(body: string) {
  return body.match(/<div class="sub-total"[^>]*>\s*<span>Monthly total<\/span>\s*<b>(\$[\d,.]+)<small>\/mo<\/small><\/b>/)?.[1]
}

function optionCard(body: string, preselect: string) {
  return body.match(/<article class="opt[^\"]*">[\s\S]*?<\/article>/g)?.find((card) => card.includes(`?preselect=${preselect}#subscribe`))
}

function subscriptionLabel(body: string, name: string) {
  return body.match(/<label class="sub-check">[\s\S]*?<\/label>/g)?.find((label) => label.includes('<b>' + name + '</b>'))
}

describe('English technical SEO page', () => {
  it('serves the approved headline, core sections, inline sources, and synthetic label in the initial HTML', () => {
    const { body } = documentFor()
    expect(body).toMatch(/<h1[^>]*>Technical SEO services with fixes you can verify<\/h1>/)
    for (const heading of ['When technical SEO help is useful', 'What a scoped engagement can cover', 'Prioritized deliverables and reporting', 'Access, scope, and fees', 'Frequently asked questions', 'Contact ADM']) {
      expect(body).toContain(heading)
    }
    for (const removed of ['Summary', 'Key Takeaways', 'About the author', 'Andrew Philip Weilbacher', 'The work, at a glance']) {
      expect(body).not.toContain(removed)
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
    expect(body).toContain('The Audit')
    expect(body).toContain('Free')
    expect(optionCard(body, 'seo-content')).toContain('<p class="opt-price">$400</p>')
    expect(optionCard(body, 'seo-content')).toContain('Per month · no minimum term')
    expect(optionCard(body, 'backlinks')).toContain('<p class="opt-price">$600</p>')
    expect(optionCard(body, 'backlinks')).toContain('Per month · 3-month minimum')
    expect(body).toContain('href="?preselect=seo-content#subscribe"')
    expect(body).toContain('href="?preselect=backlinks#subscribe"')
    expect(body).toContain('id="subscribe"')
    expect(body).toContain('Subscribe with Stripe')
    expect(subscriptionLabel(body, 'SEO Content')).toContain('Four articles each month')
  })

  it('keeps contact CTAs on the current host', () => {
    const { body } = documentFor()
    expect(body).toContain('href="/contact/">Talk with ADM about your SEO task</a>')
    expect(body).toContain('href="/contact/">Discuss your page, the issue you are seeing, and who controls implementation with ADM</a>')
  })

  it.each([
    { id: 'seo-content', name: 'SEO Content', total: '$400.00' },
    { id: 'backlinks', name: 'Backlinks', total: '$600.00' },
  ])('selects only the requested recurring option $id', ({ id, name, total }) => {
    const { body } = documentFor(`?preselect=${id}#subscribe`)
    expect(selectedServices(body)).toEqual([name])
    expect(monthlyTotal(body)).toBe(total)
  })

  it('uses the existing default package for an invalid preselect', () => {
    const { body } = documentFor('?preselect=invalid')
    expect(selectedServices(body)).toEqual(['SEO Content', 'Backlinks'])
    expect(monthlyTotal(body)).toBe('$1,000.00')
  })

  it.each(['geo', 'web-development', 'paid-search', 'meta-ads', 'ai-automation'])('keeps %s on its existing service layout', (slug) => {
    const data = pageLoad({ params: { slug }, data: serverLoad({ params: { slug } }) })
    expect(data.service).toBe(slug)
    expect(data.technicalSeo).toBeNull()
  })
})

describe('Portuguese technical SEO page', () => {
  function portugueseDocument(query = '', slug = 'technical-seo') {
    state.url = new URL(`/pt-br/servicos/${slug}/${query}`, 'https://preview.example.test')
    return render(TechnicalSeoRouteFixture, {
      props: { locale: 'pt-BR', data: portuguesePageLoad({ params: { slug }, data: portugueseServerLoad({ params: { slug } }) }) },
    })
  }

  it('renders the dedicated Portuguese article with localized workflow and FAQs', () => {
    const { body } = portugueseDocument()
    expect(body).toMatch(/<h1[^>]*>SEO técnico para investigar problemas e validar correções<\/h1>/)
    expect(body).toContain('Diagnosticar o problema')
    expect(body).toContain('Planejamento de conteúdo e topicalidade')
    expect(body.match(/<details(?:\s[^>]*)?>/g)).toHaveLength(5)
    expect(body).toContain('href="/pt-br/contato/"')
    expect(body).toContain('Assinar com Mercado Pago')
    expect(body).not.toContain('Subscribe with Stripe')
  })

  it('advertises the content checkout amount while preserving audit and separate backlink terms', () => {
    const { body } = portugueseDocument('?preselect=seo-content')
    expect(optionCard(body, 'seo-content')).toContain('<p class="opt-price">R$ 2.000</p>')
    expect(optionCard(body, 'seo-content')).toContain('4 artigos por mês')
    expect(optionCard(body, 'seo-content')).toContain('Por mês · sem prazo mínimo')
    expect(optionCard(body, 'backlinks')).toContain('<p class="opt-price">R$ 3.000</p>')
    expect(optionCard(body, 'backlinks')).toContain('Por mês · mínimo de 3 meses')
    expect(body).toContain('href="/pt-br/contato/?subject=Audit%20request"')
    expect(body).toContain('<p class="opt-price">Grátis</p>')
    expect(subscriptionLabel(body, 'Conteúdo SEO')).toContain('Quatro artigos por mês')
  })

  it('keeps one production canonical and all language alternates independent of query and preview host', () => {
    const { head } = portugueseDocument('?preselect=seo-content#subscribe')
    expect(head.match(/rel="canonical"/g)).toHaveLength(1)
    expect(head).toContain('<title>SEO técnico e local | Diagnóstico e implementação | ADM</title>')
    expect(head).toContain('name="description" content="Investigue rastreamento, renderização, indexação e URLs canônicas. Defina o escopo, os responsáveis e como validar mudanças de SEO técnico."')
    expect(head).toContain('rel="canonical" href="https://advanceddigitalmarketingltda.com/pt-br/servicos/technical-seo/"')
    expect(head).toContain('hreflang="en-US" href="https://advanceddigitalmarketingltda.com/services/technical-seo/"')
    expect(head).toContain('hreflang="pt-BR" href="https://advanceddigitalmarketingltda.com/pt-br/servicos/technical-seo/"')
    expect(head).toContain('hreflang="x-default"')
    expect(head).not.toContain('preview.example.test')
  })

  it.each([
    { query: '?preselect=seo-content', names: ['Conteúdo SEO'], total: 'R$ 2.000,00' },
    { query: '?preselect=backlinks', names: ['Backlinks'], total: 'R$ 3.000,00' },
    { query: '', names: ['Conteúdo SEO', 'Backlinks'], total: 'R$ 5.000,00' },
    { query: '?preselect=meta-ads', names: ['Conteúdo SEO', 'Backlinks'], total: 'R$ 5.000,00' },
  ])('preserves selection and BRL total for $query', ({ query, names, total }) => {
    const { body } = portugueseDocument(query)
    expect(selectedServices(body)).toEqual(names)
    expect(body).toContain('<span>Total mensal</span> <b>' + total + '<small>/mês</small>')
  })

  it.each(['geo', 'web-development', 'paid-search', 'meta-ads', 'ai-automation'])('keeps %s on the generic Portuguese layout', (slug) => {
    const { body, head } = portugueseDocument('', slug)
    expect(portugueseServerLoad({ params: { slug } }).technicalSeo).toBeNull()
    expect(body).toContain('index-home service-page portuguese')
    expect(body).not.toContain('seo-page')
    expect(head).toContain(`rel="canonical" href="https://advanceddigitalmarketingltda.com/pt-br/servicos/${slug}/"`)
  })
})
