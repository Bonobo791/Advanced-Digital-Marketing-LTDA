/**
 * Parses a USD amount typed with dot-decimal separators ("500", "500.00",
 * "1234.56"). Comma input is rejected rather than guessed (unlike BRL, where
 * the comma is the decimal separator; en-US users type dots). Values with
 * more than two decimal places are rejected rather than silently rounded.
 */
export function parseUSDInput(value: string): number | undefined {
  const raw = value.trim()
  if (!raw) return undefined
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return undefined
  const decimalPart = raw.split('.')[1]
  if (decimalPart !== undefined && decimalPart.length > 2) return undefined
  const number = Number(raw)
  return Number.isFinite(number) && number >= 0 && number <= 1_000_000 ? number : undefined
}
