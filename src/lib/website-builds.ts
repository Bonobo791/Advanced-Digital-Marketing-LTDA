/**
 * One-time website build pricing (user-defined spec).
 *
 * Website builds are a fixed one-time cost, NOT part of the monthly
 * subscription catalog. Two choices drive the price:
 *  - build type: `website` (base) or `ecommerce` (base × 2)
 *  - project kind: `new` (base) or `migration` (base × 2)
 *
 * Display prices are per locale: pt-BR pages show reais, en-US pages show
 * dollars. Checkout is always priced in BRL from `WEBSITE_BUILD_BASE_PRICE_BRL`
 * (server-side only); a browser-supplied amount is never accepted.
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

/**
 * AUTHORITATIVE one-time build price in BRL — the only amount the checkout
 * endpoint (`/api/checkout/build`) ever sends to Mercado Pago. The pt-BR
 * display prices equal these values; en-US display prices are a separate USD
 * reference. Guarded by `website-builds.unit.test.ts` so the two cannot drift.
 */
export const WEBSITE_BUILD_BASE_PRICE_BRL: Record<WebsiteBuildType, number> = {
  website: 3000,
  ecommerce: 6000,
}

/**
 * Payment-method policy for the one-time build checkout (Checkout Pro hosted
 * checkout). Maps to the preference's `payment_methods` block:
 *
 * - Offered methods: credit card (`credit_card` — à vista by default, or
 *   parcelado up to `maxInstallments`), debit card (`debit_card`), Pix /
 *   bank transfer (`bank_transfer`), and boleto (`ticket`).
 * - Checkout Pro enables every other account-enabled payment type unless it
 *   is excluded, so `excludedPaymentTypes` is the COMPLEMENT of the offered
 *   set: every known Brazil payment type outside it is excluded. Mercado
 *   Pago's wallet (`account_money`, "Dinheiro em conta") cannot be excluded
 *   by preference and therefore stays available despite the policy.
 *
 * `BRAZIL_CHECKOUT_PAYMENT_TYPES` is the known Checkout Pro type set for
 * Brazil; `OFFERED_CHECKOUT_PAYMENT_TYPES` is the site's offering. The
 * exclusion list is derived (never hand-maintained) and pinned by
 * `website-builds.unit.test.ts` so the two cannot drift.
 *
 * Values are server-side policy; the browser never sends them.
 */
/** Checkout Pro payment types available in Brazil (incl. the wallet, which
 *  cannot be excluded). Kept as a single source for the exclusion derivation. */
export const BRAZIL_CHECKOUT_PAYMENT_TYPES = [
  'credit_card',
  'debit_card',
  'prepaid_card',
  'bank_transfer',
  'ticket',
  'account_money',
  'digital_currency',
] as const

/** The types this checkout offers (matches the site copy: credit/debit/Pix/boleto). */
export const OFFERED_CHECKOUT_PAYMENT_TYPES = ['credit_card', 'debit_card', 'bank_transfer', 'ticket'] as const

const excludedPaymentTypes = BRAZIL_CHECKOUT_PAYMENT_TYPES.filter(
  (type) => !(OFFERED_CHECKOUT_PAYMENT_TYPES as readonly string[]).includes(type),
)

export const WEBSITE_BUILD_CHECKOUT_PAYMENT_METHODS = {
  /** Maximum credit-card installments offered (parcelado). */
  maxInstallments: 12,
  /** Installments preselected in the hosted checkout — 1 means à vista. */
  defaultInstallments: 1,
  /**
   * Checkout Pro payment types excluded from the hosted checkout: every
   * known Brazil type outside the offered set (`account_money` is listed
   * but cannot actually be excluded — Mercado Pago keeps the wallet).
   */
  excludedPaymentTypes,
} as const

/** One-time build price in BRL (checkout currency), including the kind multiplier. */
export function websiteBuildPriceBRL(type: WebsiteBuildType, kind: WebsiteBuildKind): number {
  const base = WEBSITE_BUILD_BASE_PRICE_BRL[type]
  return kind === 'migration' ? base * MIGRATION_MULTIPLIER : base
}

export function isWebsiteBuildType(value: unknown): value is WebsiteBuildType {
  return typeof value === 'string' && (WEBSITE_BUILD_TYPES as readonly string[]).includes(value)
}

export function isWebsiteBuildKind(value: unknown): value is WebsiteBuildKind {
  return typeof value === 'string' && (WEBSITE_BUILD_KINDS as readonly string[]).includes(value)
}

/** Build names per locale and type (single source for UI and checkout titles). */
export const WEBSITE_BUILD_NAMES: Record<Locale, Record<WebsiteBuildType, string>> = {
  'en-US': { website: 'Website Development', ecommerce: 'Ecommerce Website Development' },
  'pt-BR': { website: 'Desenvolvimento de Site', ecommerce: 'Desenvolvimento de Site E-commerce' },
}

const MIGRATION_SUFFIX: Record<Locale, string> = {
  'en-US': ' (Migration)',
  'pt-BR': ' (Migração)',
}

/** Checkout item title, e.g. "Ecommerce Website Development (Migration)". */
export function websiteBuildTitle(locale: Locale, type: WebsiteBuildType, kind: WebsiteBuildKind): string {
  return kind === 'migration' ? `${WEBSITE_BUILD_NAMES[locale][type]}${MIGRATION_SUFFIX[locale]}` : WEBSITE_BUILD_NAMES[locale][type]
}

/** Deterministic Mercado Pago `external_reference`, e.g. "website-build:website:new". */
export function websiteBuildExternalReference(type: WebsiteBuildType, kind: WebsiteBuildKind): string {
  return `website-build:${type}:${kind}`
}

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
