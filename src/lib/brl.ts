/**
 * Parses a BRL amount typed with Brazilian separators.
 *
 * "1.000" / "10.000,50" (dots as thousands, comma as decimal) and plain
 * integers are supported. Dot-decimal input ("500.00", "1000.50") is
 * recognized as a decimal rather than silently inflated by stripping the dot —
 * the old behavior turned "500.00" into 50000 and billed a R$ 5,000 fee.
 *
 * Ambiguous or malformed input is rejected instead of guessed: repeated dots
 * are only thousands separators when every group after the first has exactly
 * three digits ("1.000.000" → 1_000_000), so mixed separators like "1.000.50"
 * are NOT inflated to 100050. Values with more than two decimal places are
 * rejected rather than silently rounded.
 */
export function parseBRLInput(value: string): number | undefined {
  const raw = value.trim()
  if (!raw) return undefined
  // Only digits with optional dot/comma separators are accepted.
  if (!/^\d+(?:[.,]\d+)*$/.test(raw)) return undefined

  const normalized = normalizeSeparators(raw)
  if (normalized === undefined) return undefined

  // Money hygiene: at most two decimal places ("500,999" must not become a
  // valid amount that reaches transaction_amount).
  const decimalPart = normalized.split('.')[1]
  if (decimalPart !== undefined && decimalPart.length > 2) return undefined

  const number = Number(normalized)
  return Number.isFinite(number) && number >= 0 && number <= 1_000_000 ? number : undefined
}

/**
 * Normalizes Brazilian separators to a dot-decimal string, or returns
 * `undefined` for separator patterns that cannot be interpreted safely.
 *
 * - Both separators present: Brazilian convention — dots are thousands
 *   separators, comma is the decimal separator ("10.000,50" → "10000.50").
 * - Comma only: comma is the decimal separator ("1000,50" → "1000.50").
 * - Dots only: a single dot is ambiguous — exactly 3 digits after it with
 *   digits before it means thousands ("1.000" → "1000"), anything else is a
 *   decimal ("1000.50", "500.00" → "500"). Repeated dots can only be
 *   thousands, and only when every group after the first is exactly 3 digits;
 *   otherwise the input mixes separators and is rejected ("1.000.50").
 */
function normalizeSeparators(raw: string): string | undefined {
  const hasDot = raw.includes('.')
  const hasComma = raw.includes(',')

  if (hasDot && hasComma) {
    return raw.replaceAll('.', '').replace(',', '.')
  }
  if (hasComma) {
    return raw.replace(',', '.')
  }
  if (hasDot) {
    const parts = raw.split('.')
    if (parts.length > 2) {
      const thousandsGroups = parts.slice(1)
      const allThreeDigit = thousandsGroups.every((group) => group.length === 3)
      if (!allThreeDigit) return undefined
      return parts.join('')
    }
    // Ambiguous single dot: exactly 3 digits after it with digits before it
    // means thousands ("1.000" → 1000); anything else is a decimal
    // ("1000.50", "500.00" → 500).
    const [intPart, decPart] = parts
    return intPart && decPart.length === 3 ? intPart + decPart : raw
  }
  return raw
}
