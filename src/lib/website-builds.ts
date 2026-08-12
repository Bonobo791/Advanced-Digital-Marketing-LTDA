/**
 * One-time website build pricing (user-defined spec).
 *
 * Website builds are a fixed one-time cost, NOT part of the monthly
 * subscription catalog. Two choices drive the price:
 *  - build type: `website` (base) or `ecommerce` (base × 2)
 *  - project kind: `new` (base) or `migration` (base × 2)
 *
 * Prices are per locale: pt-BR pages show reais, en-US pages show dollars.
 */
import type { Locale } from '$lib/locale'

export const WEBSITE_BUILD_TYPES = ['website', 'ecommerce'] as const
export type WebsiteBuildType = (typeof WEBSITE_BUILD_TYPES)[number]

export const WEBSITE_BUILD_KINDS = ['new', 'migration'] as const
export type WebsiteBuildKind = (typeof WEBSITE_BUILD_KINDS)[number]

/** Base one-time price per locale and build type (before the kind multiplier). */
export const WEBSITE_BUILD_BASE_PRICE: Record<Locale, Record<WebsiteBuildType, number>> = {
  'en-US': { website: 750, ecommerce: 1500 },
  'pt-BR': { website: 3000, ecommerce: 6000 },
}

/** Migrating an existing site costs 2× the base build price. */
export const MIGRATION_MULTIPLIER = 2

export function websiteBuildPrice(locale: Locale, type: WebsiteBuildType, kind: WebsiteBuildKind): number {
  const base = WEBSITE_BUILD_BASE_PRICE[locale][type]
  return kind === 'migration' ? base * MIGRATION_MULTIPLIER : base
}

const brlWholeFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})
const usdWholeFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

/** Formats a build price in the locale's currency, whole (e.g. R$ 3.000 / $1,500). */
export function formatBuildPrice(locale: Locale, value: number): string {
  return locale === 'pt-BR' ? brlWholeFormatter.format(value) : usdWholeFormatter.format(value)
}
