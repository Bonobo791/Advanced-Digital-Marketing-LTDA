import { describe, expect, it } from 'vitest'
import {
  ADS_SPEND_RULE,
  SERVICES,
  SERVICE_IDS,
  adSpendFeeBRL,
  formatBRL,
  formatPrice,
  formatUSD,
  getService,
  isServiceId,
  isSubscribable,
} from './catalog'

describe('catalog integrity', () => {
  it('defines every advertised service id in the catalog', () => {
    expect(SERVICE_IDS.length).toBe(Object.keys(SERVICES).length)
    for (const id of SERVICE_IDS) {
      expect(SERVICES[id]).toBeDefined()
      expect(SERVICES[id].id).toBe(id)
    }
  })

  it('has unique service ids', () => {
    expect(new Set(SERVICE_IDS).size).toBe(SERVICE_IDS.length)
  })

  it('marks every service active', () => {
    for (const id of SERVICE_IDS) expect(SERVICES[id].active).toBe(true)
  })
})

describe('isServiceId', () => {
  it('accepts every catalog id', () => {
    for (const id of SERVICE_IDS) expect(isServiceId(id)).toBe(true)
  })

  it('rejects unknown, empty and non-string values', () => {
    for (const value of ['seo', 'google_ads', 'hosting-extra', '', 42, null, undefined, {}, ['seo-content']]) {
      expect(isServiceId(value)).toBe(false)
    }
  })
})

describe('catalog pricing (user-defined)', () => {
  it('stores the agreed BRL prices with USD display references', () => {
    expect(SERVICES['seo-content'].pricing).toEqual({ kind: 'fixed', monthlyBRL: 2000, monthlyUSD: 400 })
    expect(SERVICES.backlinks.pricing).toEqual({ kind: 'fixed', monthlyBRL: 3000, monthlyUSD: 600 })
    expect(SERVICES.hosting.pricing).toEqual({ kind: 'fixed', monthlyBRL: 300, monthlyUSD: 60 })
  })

  it('prices ads services by the ad-spend rule', () => {
    expect(SERVICES['paid-search'].pricing).toEqual({ kind: 'ads-spend' })
    expect(SERVICES['meta-ads'].pricing).toEqual({ kind: 'ads-spend' })
  })

  it('marks AI automation as quote-only', () => {
    expect(SERVICES['ai-automation'].pricing).toEqual({ kind: 'quote' })
  })

  it('exposes the ad-spend rule constants', () => {
    expect(ADS_SPEND_RULE).toEqual({ rate: 0.1, minimumBRL: 500, minimumUSD: 100 })
  })
})

describe('adSpendFeeBRL', () => {
  it('applies the R$ 500 minimum below 10% of spend', () => {
    expect(adSpendFeeBRL(3000)).toBe(500) // 10% = 300 < 500
    expect(adSpendFeeBRL(5000)).toBe(500) // 10% = 500 == minimum
  })

  it('charges 10% of spend above the minimum', () => {
    expect(adSpendFeeBRL(10000)).toBe(1000)
    expect(adSpendFeeBRL(15000)).toBe(1500)
  })

  it('rounds fractional fees to cents', () => {
    expect(adSpendFeeBRL(12345.67)).toBe(1234.57) // 1234.567 → 1234.57
    expect(adSpendFeeBRL(999.99)).toBe(500) // below minimum, still rounded
  })

  it('still charges the minimum for zero spend', () => {
    expect(adSpendFeeBRL(0)).toBe(500)
  })
})

describe('isSubscribable', () => {
  it('allows active fixed and ads-spend services', () => {
    expect(isSubscribable(SERVICES['seo-content'])).toBe(true)
    expect(isSubscribable(SERVICES['paid-search'])).toBe(true)
  })

  it('blocks quote-only services', () => {
    expect(isSubscribable(SERVICES['ai-automation'])).toBe(false)
  })

  it('blocks inactive services', () => {
    expect(isSubscribable({ ...SERVICES.hosting, active: false })).toBe(false)
  })
})

describe('formatBRL / formatUSD', () => {
  it('formats BRL the Brazilian way (R$ 2.650,00)', () => {
    expect(formatBRL(2650)).toBe('R$\u00A02.650,00')
  })

  it('formats USD the American way', () => {
    expect(formatUSD(400)).toBe('$400.00')
  })
})

describe('formatPrice', () => {
  it('shows BRL on pt-BR pages and USD on en-US pages', () => {
    expect(formatPrice('pt-BR', 300, 60)).toBe('R$\u00A0300,00')
    expect(formatPrice('en-US', 300, 60)).toBe('$60.00')
  })

  it('converts BRL to USD at the 5:1 reference rate when no USD reference exists', () => {
    expect(formatPrice('en-US', 500)).toBe('$100.00')
  })
})

describe('getService', () => {
  it('returns the service for a known id and undefined otherwise', () => {
    expect(getService('hosting')).toBe(SERVICES.hosting)
    expect(getService('nope')).toBeUndefined()
  })
})
