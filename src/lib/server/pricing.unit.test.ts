import { describe, expect, it } from 'vitest'
import { SERVICES, type CatalogService, type ServiceId } from '$lib/catalog'
import { PricingError, computeMonthlyQuote } from './pricing'

const CATALOG = SERVICES as Record<ServiceId, CatalogService>

/** Catalog clone with one service made inactive, for the inactive-path tests. */
function catalogWithInactive(id: ServiceId): Record<ServiceId, CatalogService> {
  return { ...SERVICES, [id]: { ...SERVICES[id], active: false } }
}

const ADS_SPEND = {
  'paid-search': { monthlyAdSpend: 10000 },
  'meta-ads': { monthlyAdSpend: 3000 },
}

describe('computeMonthlyQuote — totals', () => {
  it('prices a single fixed service', () => {
    const quote = computeMonthlyQuote(['seo-content'], {}, 'pt-BR')
    expect(quote.totalBRL).toBe(2000)
    expect(quote.items).toEqual([{ id: 'seo-content', name: 'Conteúdo SEO', monthlyBRL: 2000 }])
  })

  it('sums multiple fixed services', () => {
    const quote = computeMonthlyQuote(['seo-content', 'backlinks', 'hosting'], {}, 'pt-BR')
    expect(quote.totalBRL).toBe(2000 + 3000 + 750)
    expect(quote.items.map((item) => item.id)).toEqual(['seo-content', 'backlinks', 'hosting'])
  })

  it('applies the ad-spend rule and sums everything (all services)', () => {
    const quote = computeMonthlyQuote(
      ['seo-content', 'backlinks', 'hosting', 'paid-search', 'meta-ads'],
      ADS_SPEND,
      'pt-BR',
    )
    // 2000 + 3000 + 750 + max(10%×10000, 500) + max(10%×3000, 500)
    expect(quote.totalBRL).toBe(2000 + 3000 + 750 + 1000 + 500)
  })

  it('charges the R$ 500 minimum for a low ad spend', () => {
    const quote = computeMonthlyQuote(['meta-ads'], { 'meta-ads': { monthlyAdSpend: 3000 } }, 'pt-BR')
    expect(quote.totalBRL).toBe(500)
  })

  it('rounds the total to cent precision', () => {
    const quote = computeMonthlyQuote(
      ['paid-search'],
      { 'paid-search': { monthlyAdSpend: 12345.67 } },
      'pt-BR',
    )
    expect(quote.totalBRL).toBe(1234.57)
  })

  it('charges 10% above the minimum', () => {
    const quote = computeMonthlyQuote(['paid-search'], { 'paid-search': { monthlyAdSpend: 10000 } }, 'pt-BR')
    expect(quote.totalBRL).toBe(1000)
  })
})

describe('computeMonthlyQuote — reason and external_reference', () => {
  it('builds a localized, human-readable reason', () => {
    const quote = computeMonthlyQuote(
      ['hosting', 'seo-content'],
      {},
      'pt-BR',
    )
    expect(quote.reason).toBe('Conteúdo SEO + Hospedagem')
  })

  it('uses English names for the en-US locale', () => {
    const quote = computeMonthlyQuote(['seo-content', 'backlinks'], {}, 'en-US')
    expect(quote.reason).toBe('SEO Content + Backlinks')
  })

  it('builds a deterministic id-based external reference in catalog order', () => {
    const scrambled = computeMonthlyQuote(
      ['meta-ads', 'seo-content', 'paid-search', 'hosting', 'backlinks'],
      ADS_SPEND,
      'pt-BR',
    )
    expect(scrambled.externalReference).toBe('seo-content+backlinks+hosting+paid-search+meta-ads')
    expect(scrambled.reason).toBe(
      'Conteúdo SEO + Backlinks + Hospedagem + Gestão de Google Ads + Gestão de Meta Ads',
    )
  })
})

describe('computeMonthlyQuote — validation', () => {
  it('rejects an empty selection', () => {
    expect(() => computeMonthlyQuote([], {}, 'pt-BR')).toThrowError(
      expect.objectContaining({ code: 'no_services_selected' }),
    )
    expect(() => computeMonthlyQuote(undefined, {}, 'pt-BR')).toThrowError(
      expect.objectContaining({ code: 'no_services_selected' }),
    )
    expect(() => computeMonthlyQuote('seo-content', {}, 'pt-BR')).toThrowError(
      expect.objectContaining({ code: 'no_services_selected' }),
    )
  })

  it('rejects unknown service ids', () => {
    for (const bad of [['nope'], ['seo-content', 'hosting-evil'], ['seo-content', 42]]) {
      expect(() => computeMonthlyQuote(bad, {}, 'pt-BR')).toThrowError(
        expect.objectContaining({ code: 'invalid_service' }),
      )
    }
  })

  it('rejects inactive services', () => {
    const inactiveCatalog = catalogWithInactive('hosting')
    expect(() => computeMonthlyQuote(['hosting'], {}, 'pt-BR', inactiveCatalog)).toThrowError(
      expect.objectContaining({ code: 'service_unavailable' }),
    )
  })

  it('rejects quote-only services', () => {
    expect(() => computeMonthlyQuote(['ai-automation'], {}, 'pt-BR')).toThrowError(
      expect.objectContaining({ code: 'quote_only_service' }),
    )
    // A quote-only service alongside valid ones still fails.
    expect(() => computeMonthlyQuote(['seo-content', 'ai-automation'], {}, 'pt-BR')).toThrowError(
      expect.objectContaining({ code: 'quote_only_service' }),
    )
  })

  it('rejects invalid ad-spend configuration for selected ads services', () => {
    const badConfigs: unknown[] = [
      {}, // missing spend
      { 'paid-search': {} },
      { 'paid-search': { monthlyAdSpend: undefined } },
      { 'paid-search': { monthlyAdSpend: -1 } },
      { 'paid-search': { monthlyAdSpend: '10000' } },
      { 'paid-search': { monthlyAdSpend: NaN } },
      { 'paid-search': { monthlyAdSpend: Infinity } },
      { 'paid-search': { monthlyAdSpend: 1_000_001 } },
    ]
    for (const config of badConfigs) {
      expect(() => computeMonthlyQuote(['paid-search'], config, 'pt-BR')).toThrowError(
        expect.objectContaining({ code: 'invalid_ad_spend' }),
      )
    }
  })

  it('ignores configuration for services that are not selected', () => {
    const quote = computeMonthlyQuote(['seo-content'], { 'paid-search': { monthlyAdSpend: -5 } }, 'pt-BR')
    expect(quote.totalBRL).toBe(2000)
  })

  it('accepts zero ad spend (minimum fee applies)', () => {
    const quote = computeMonthlyQuote(['meta-ads'], { 'meta-ads': { monthlyAdSpend: 0 } }, 'pt-BR')
    expect(quote.totalBRL).toBe(500)
  })

  it('throws PricingError instances with machine-readable codes', () => {
    try {
      computeMonthlyQuote(['nope'], {}, 'pt-BR')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(PricingError)
      expect((error as PricingError).code).toBe('invalid_service')
    }
  })
})
