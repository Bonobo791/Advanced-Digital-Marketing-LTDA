import { describe, expect, it } from 'vitest'
import {
  MIGRATION_MULTIPLIER,
  WEBSITE_BUILD_BASE_PRICE,
  WEBSITE_BUILD_BASE_PRICE_BRL,
  WEBSITE_BUILD_NAMES,
  WEBSITE_BUILD_TYPES,
  formatBuildPrice,
  isWebsiteBuildKind,
  isWebsiteBuildType,
  websiteBuildExternalReference,
  websiteBuildPrice,
  websiteBuildPriceBRL,
  websiteBuildTitle,
} from './website-builds'

describe('website build pricing (user-defined)', () => {
  it('stores the agreed base prices per locale and build type', () => {
    expect(WEBSITE_BUILD_BASE_PRICE['en-US']).toEqual({ website: 750, ecommerce: 1500 })
    expect(WEBSITE_BUILD_BASE_PRICE['pt-BR']).toEqual({ website: 3000, ecommerce: 6000 })
  })

  it('keeps new-build prices at the base rate', () => {
    expect(websiteBuildPrice('en-US', 'website', 'new')).toBe(750)
    expect(websiteBuildPrice('en-US', 'ecommerce', 'new')).toBe(1500)
    expect(websiteBuildPrice('pt-BR', 'website', 'new')).toBe(3000)
    expect(websiteBuildPrice('pt-BR', 'ecommerce', 'new')).toBe(6000)
  })

  it('applies the 2× multiplier for migrations', () => {
    expect(MIGRATION_MULTIPLIER).toBe(2)
    expect(websiteBuildPrice('en-US', 'website', 'migration')).toBe(1500)
    expect(websiteBuildPrice('en-US', 'ecommerce', 'migration')).toBe(3000)
    expect(websiteBuildPrice('pt-BR', 'website', 'migration')).toBe(6000)
    expect(websiteBuildPrice('pt-BR', 'ecommerce', 'migration')).toBe(12000)
  })
})

describe('formatBuildPrice', () => {
  it('formats whole prices without cents in the locale currency', () => {
    expect(formatBuildPrice('en-US', 750)).toBe('$750')
    expect(formatBuildPrice('en-US', 1500)).toBe('$1,500')
    expect(formatBuildPrice('pt-BR', 3000)).toBe('R$\u00A03.000')
    expect(formatBuildPrice('pt-BR', 12000)).toBe('R$\u00A012.000')
  })
})

describe('authoritative BRL pricing (checkout currency)', () => {
  it('stores the BRL base prices that checkout bills', () => {
    expect(WEBSITE_BUILD_BASE_PRICE_BRL).toEqual({ website: 3000, ecommerce: 6000 })
  })

  it('keeps the pt-BR display prices equal to the authoritative BRL prices', () => {
    // The pt-BR page shows exactly what the /api/checkout/build endpoint
    // bills — if they ever diverge, this fails loudly.
    expect(WEBSITE_BUILD_BASE_PRICE['pt-BR']).toEqual(WEBSITE_BUILD_BASE_PRICE_BRL)
  })

  it('prices new builds at the BRL base and migrations at 2×', () => {
    expect(websiteBuildPriceBRL('website', 'new')).toBe(3000)
    expect(websiteBuildPriceBRL('ecommerce', 'new')).toBe(6000)
    expect(websiteBuildPriceBRL('website', 'migration')).toBe(6000)
    expect(websiteBuildPriceBRL('ecommerce', 'migration')).toBe(12000)
  })
})

describe('website build guards and checkout metadata', () => {
  it('validates build types and kinds', () => {
    expect(isWebsiteBuildType('website')).toBe(true)
    expect(isWebsiteBuildType('ecommerce')).toBe(true)
    expect(isWebsiteBuildType('shopify')).toBe(false)
    expect(isWebsiteBuildType(42)).toBe(false)
    expect(isWebsiteBuildType(undefined)).toBe(false)
    expect(isWebsiteBuildKind('new')).toBe(true)
    expect(isWebsiteBuildKind('migration')).toBe(true)
    expect(isWebsiteBuildKind('redesign')).toBe(false)
  })

  it('builds deterministic external references without PII', () => {
    expect(websiteBuildExternalReference('website', 'new')).toBe('website-build:website:new')
    expect(websiteBuildExternalReference('ecommerce', 'migration')).toBe('website-build:ecommerce:migration')
  })

  it('builds checkout titles per locale, flagging migrations', () => {
    expect(websiteBuildTitle('en-US', 'website', 'new')).toBe('Website Development')
    expect(websiteBuildTitle('en-US', 'ecommerce', 'migration')).toBe('Ecommerce Website Development (Migration)')
    expect(websiteBuildTitle('pt-BR', 'website', 'new')).toBe('Desenvolvimento de Site')
    expect(websiteBuildTitle('pt-BR', 'ecommerce', 'migration')).toBe('Desenvolvimento de Site E-commerce (Migração)')
  })

  it('keeps the UI names in sync with the checkout titles', () => {
    for (const locale of ['en-US', 'pt-BR'] as const) {
      for (const type of WEBSITE_BUILD_TYPES) {
        expect(websiteBuildTitle(locale, type, 'new')).toBe(WEBSITE_BUILD_NAMES[locale][type])
      }
    }
  })
})
