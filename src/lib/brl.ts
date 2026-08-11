/**
 * Parses a BRL amount typed with Brazilian separators.
 *
 * "1.000" / "10.000,50" (dots as thousands, comma as decimal) and plain
 * integers are supported. Dot-decimal input ("500.00", "1000.50") is
 * recognized as a decimal rather than silently inflated by stripping the dot —
 * the old behavior turned "500.00" into 50000 and billed a R$ 5,000 fee.
 */
export function parseBRLInput(value: string): number | undefined {
  const raw = value.trim()
  if (!raw) return undefined
  // Only digits with optional dot/comma separators are accepted.
  if (!/^\d+(?:[.,]\d+)*$/.test(raw)) return undefined
  const hasDot = raw.includes('.')
  const hasComma = raw.includes(',')
  let normalized: string
  if (hasDot && hasComma) {
    // Brazilian convention: dots are thousands separators, comma is decimal.
    normalized = raw.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    normalized = raw.replace(',', '.')
  } else if (hasDot) {
    const parts = raw.split('.')
    if (parts.length > 2) {
      // Repeated dots can only be thousands separators ("1.000.000").
      normalized = raw.replace(/\./g, '')
    } else {
      // Ambiguous single dot: exactly 3 digits after it with digits before it
      // means thousands ("1.000" → 1000); anything else is a decimal
      // ("1000.50", "500.00" → 500).
      const [intPart, decPart] = parts
      normalized = intPart && decPart.length === 3 ? intPart + decPart : raw
    }
  } else {
    normalized = raw
  }
  const number = Number(normalized)
  return Number.isFinite(number) && number >= 0 && number <= 1_000_000 ? number : undefined
}
