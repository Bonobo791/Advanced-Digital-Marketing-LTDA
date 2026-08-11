import { describe, expect, it } from 'vitest'
import {
  MIGRATION_MULTIPLIER,
  WEBSITE_BUILD_BASE_PRICE,
  formatBuildPrice,
  websiteBuildPrice,
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
