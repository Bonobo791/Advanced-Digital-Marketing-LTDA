/**
 * Guards the USD ad-spend parser (src/lib/usd.ts): dot-decimal only, max two
 * decimals, no signs/exponents/commas, non-negative, and bounded by the shared
 * MAX_MONTHLY_AD_SPEND — the client-side twin of the server validator.
 */
import { describe, expect, it } from 'vitest'
import { MAX_MONTHLY_AD_SPEND } from './catalog'
import { parseUSDInput } from './usd'

describe('parseUSDInput', () => {
  it('accepts plain and dot-decimal amounts', () => {
    expect(parseUSDInput('500')).toBe(500)
    expect(parseUSDInput('500.00')).toBe(500)
    expect(parseUSDInput('1234.56')).toBe(1234.56)
    expect(parseUSDInput(' 500 ')).toBe(500)
  })

  it('rejects comma separators (en-US uses dots)', () => {
    expect(parseUSDInput('1,000')).toBeUndefined()
    expect(parseUSDInput('1,000.50')).toBeUndefined()
  })

  it('rejects more than two decimals instead of silently rounding', () => {
    expect(parseUSDInput('1.234')).toBeUndefined()
    expect(parseUSDInput('0.001')).toBeUndefined()
  })

  it('rejects signs, exponent notation and nonnumeric input', () => {
    for (const value of ['-1', '+1', '1e3', '1E3', 'abc', '1 2', '1.2.3']) {
      expect(parseUSDInput(value)).toBeUndefined()
    }
  })

  it('rejects blank input', () => {
    expect(parseUSDInput('')).toBeUndefined()
    expect(parseUSDInput('   ')).toBeUndefined()
  })

  it('enforces the shared upper bound and the non-negative floor', () => {
    expect(parseUSDInput(String(MAX_MONTHLY_AD_SPEND))).toBe(MAX_MONTHLY_AD_SPEND)
    expect(parseUSDInput(String(MAX_MONTHLY_AD_SPEND + 1))).toBeUndefined()
    expect(parseUSDInput('0')).toBe(0)
  })
})
