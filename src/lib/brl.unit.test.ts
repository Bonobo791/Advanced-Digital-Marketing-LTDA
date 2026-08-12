import { describe, expect, it } from 'vitest'
import { parseBRLInput } from './brl'

describe('parseBRLInput', () => {
  it('parses plain integers', () => {
    expect(parseBRLInput('10000')).toBe(10000)
    expect(parseBRLInput('0')).toBe(0)
  })

  it('parses Brazilian thousands separators', () => {
    expect(parseBRLInput('1.000')).toBe(1000)
    expect(parseBRLInput('10.000')).toBe(10000)
    expect(parseBRLInput('1.000.000')).toBe(1_000_000)
  })

  it('parses comma decimals', () => {
    expect(parseBRLInput('1000,50')).toBe(1000.5)
    expect(parseBRLInput('10.000,50')).toBe(10000.5)
  })

  it('recognizes dot-decimal input instead of inflating it', () => {
    expect(parseBRLInput('500.00')).toBe(500) // was 50000 before the fix
    expect(parseBRLInput('1000.50')).toBe(1000.5) // was 100050 before the fix
    expect(parseBRLInput('1.5')).toBe(1.5)
  })

  it('rejects mixed separators instead of inflating them', () => {
    // A repeated dot is only a thousands separator when every group after the
    // first has exactly three digits; '1.000.50' mixes a 3-digit and a 2-digit
    // group, so treating the dots as thousands would inflate 1000.50 to 100050.
    expect(parseBRLInput('1.000.50')).toBeUndefined()
    expect(parseBRLInput('12.345.67')).toBeUndefined()
  })

  it('accepts repeated dots only as well-formed thousands groups', () => {
    expect(parseBRLInput('1.000.000')).toBe(1_000_000)
    // A 3-digit group after a multi-digit integer is well-formed thousands too
    // (123.456 → 123456), as long as the total stays under the 1,000,000 cap.
    expect(parseBRLInput('123.456')).toBe(123456)
  })

  it('rejects values with more than two decimal places', () => {
    // 3+ fractional digits must not reach transaction_amount.
    expect(parseBRLInput('500,999')).toBeUndefined()
    expect(parseBRLInput('10.000,999')).toBeUndefined()
  })

  it('rejects empty, negative, non-numeric and oversized values', () => {
    expect(parseBRLInput('')).toBeUndefined()
    expect(parseBRLInput('   ')).toBeUndefined()
    expect(parseBRLInput('-5')).toBeUndefined()
    expect(parseBRLInput('abc')).toBeUndefined()
    expect(parseBRLInput('2.000.000')).toBeUndefined()
    expect(parseBRLInput('1e6')).toBeUndefined()
  })
})
