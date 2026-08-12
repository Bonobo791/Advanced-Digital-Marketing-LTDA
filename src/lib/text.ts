/** Splits a heading into words, collapsing runs of whitespace. */
export function words(value: string): string[] {
  return value.trim().split(/\s+/)
}
