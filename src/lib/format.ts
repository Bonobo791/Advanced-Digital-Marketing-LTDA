const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/** Formats integer BRL cents (e.g. 350_000) as "R$ 3.500,00". */
export function formatBRL(cents: number): string {
  return brlFormatter.format(cents / 100)
}

/** Formats integer BRL cents as a decimal number (e.g. 350000 -> 3500). */
export function centsToBRL(cents: number): number {
  return cents / 100
}
