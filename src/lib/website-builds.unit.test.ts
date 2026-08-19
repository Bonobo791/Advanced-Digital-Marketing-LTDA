import { describe, expect, it } from 'vitest'
import {
  BRAZIL_CHECKOUT_PAYMENT_TYPES,
  MIGRATION_MULTIPLIER,
  OFFERED_CHECKOUT_PAYMENT_TYPES,
  WEBSITE_BUILD_BASE_PRICE,
  WEBSITE_BUILD_BASE_PRICE_BRL,
  WEBSITE_BUILD_CHECKOUT_PAYMENT_METHODS,
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

describe('WEBSITE_BUILD_CHECKOUT_PAYMENT_METHODS (Checkout Pro policy)', () => {
  it('preselects à vista within the allowed installment range', () => {
    expect(WEBSITE_BUILD_CHECKOUT_PAYMENT_METHODS.defaultInstallments).toBeGreaterThanOrEqual(1)
    expect(WEBSITE_BUILD_CHECKOUT_PAYMENT_METHODS.defaultInstallments).toBeLessThanOrEqual(
      WEBSITE_BUILD_CHECKOUT_PAYMENT_METHODS.maxInstallments,
    )
  })

  it('only excludes non-empty Mercado Pago payment-type ids', () => {
    expect(WEBSITE_BUILD_CHECKOUT_PAYMENT_METHODS.excludedPaymentTypes.length).toBeGreaterThan(0)
    for (const id of WEBSITE_BUILD_CHECKOUT_PAYMENT_METHODS.excludedPaymentTypes) {
      expect(id.length).toBeGreaterThan(0)
    }
  })

  it('excludes every known Brazil payment type outside the offered set (complete policy)', () => {
    // Checkout Pro enables all account methods unless excluded, so the
    // exclusion list must be the complement of the offered set — otherwise
    // e.g. prepaid cards or digital currency would appear in the checkout.
    const offered = OFFERED_CHECKOUT_PAYMENT_TYPES as readonly string[]
    for (const type of BRAZIL_CHECKOUT_PAYMENT_TYPES) {
      if (offered.includes(type)) {
        expect(WEBSITE_BUILD_CHECKOUT_PAYMENT_METHODS.excludedPaymentTypes).not.toContain(type)
      } else if (type !== 'account_money') {
        // account_money (the Mercado Pago wallet) cannot be excluded by
        // preference — the docs say so — every other type must be.
        expect(WEBSITE_BUILD_CHECKOUT_PAYMENT_METHODS.excludedPaymentTypes).toContain(type)
      }
    }
  })

  it('never excludes an offered method', () => {
    for (const type of OFFERED_CHECKOUT_PAYMENT_TYPES) {
      expect(WEBSITE_BUILD_CHECKOUT_PAYMENT_METHODS.excludedPaymentTypes).not.toContain(type)
    }
  })
})
