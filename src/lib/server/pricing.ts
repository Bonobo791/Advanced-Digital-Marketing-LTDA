/**
 * Authoritative subscription pricing (spec §4).
 *
 * The browser sends only selections and configuration; this module
 * independently recalculates every price from the server-side catalog. A
 * client-supplied total is never accepted — the trust boundary is:
 * browser picks services, server prices them, Mercado Pago bills them.
 */
import {
  ADS_SPEND_RULE,
  BRL_USD_REFERENCE_RATE,
  CATALOG_SERVICE_IDS,
  MAX_MONTHLY_AD_SPEND,
  SERVICES,
  adSpendFeeBRL,
  getService,
  isSubscribable,
  type CatalogService,
  type CatalogServiceId,
} from '$lib/catalog'
import type { Locale } from '$lib/locale'

export type PricingErrorCode =
  | 'invalid_service'
  | 'service_unavailable'
  | 'quote_only_service'
  | 'invalid_ad_spend'
  | 'no_services_selected'
  | 'invalid_build'

export class PricingError extends Error {
  code: PricingErrorCode

  constructor(code: PricingErrorCode, message: string) {
    super(message)
    this.name = 'PricingError'
    this.code = code
  }
}

export type LineItem = {
  id: CatalogServiceId
  name: string
  monthlyBRL: number
}

export type PriceQuote = {
  items: LineItem[]
  totalBRL: number
  reason: string
  externalReference: string
}

/**
 * Validates a `monthlyAdSpend` configuration value. Accepts a finite number
 * between 0 and MAX_MONTHLY_AD_SPEND (a R$ 0 spend still pays the minimum
 * management fee).
 */
function isValidAdSpend(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_MONTHLY_AD_SPEND
}

/** Extracts and validates the per-service monthly ad spend from the config. */
export function monthlyAdSpendOf(rawConfig: Record<string, unknown>, id: CatalogServiceId): number {
  const perService = rawConfig[id]
  const value =
    typeof perService === 'object' && perService !== null
      ? (perService as Record<string, unknown>).monthlyAdSpend
      : undefined
  if (!isValidAdSpend(value)) {
    throw new PricingError('invalid_ad_spend', `Invalid monthly ad spend for ${id}`)
  }
  return value
}

/** One resolved quote line (currency-agnostic amount; the public quote types
 *  map this to their BRL/USD shape). */
export type QuoteItem = { id: CatalogServiceId; name: string; amount: number }

/**
 * Shared subscription-quote pipeline (single source of truth for the BRL and
 * USD quote paths — they must never drift apart): validates the selection,
 * iterates the catalog in order (deduplicated), resolves each amount with
 * `resolveAmount`, enforces the zero-total guard, rounds to cents, and builds
 * the reason + deterministic externalReference.
 *
 * Throws `PricingError` with a machine-readable code on any invalid input.
 */
export function buildQuote(
  serviceIds: unknown,
  config: unknown,
  locale: Locale,
  catalog: Record<CatalogServiceId, CatalogService>,
  resolveAmount: (id: CatalogServiceId, service: CatalogService, rawConfig: Record<string, unknown>) => number,
): { items: QuoteItem[]; total: number; reason: string; externalReference: string } {
  if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
    throw new PricingError('no_services_selected', 'No services selected')
  }

  const rawConfig = typeof config === 'object' && config !== null ? (config as Record<string, unknown>) : {}

  const selection = new Set<CatalogServiceId>()
  for (const rawId of serviceIds) {
    if (typeof rawId !== 'string' || !Object.hasOwn(catalog, rawId)) {
      throw new PricingError('invalid_service', `Unknown service: ${String(rawId)}`)
    }
    const id = rawId as CatalogServiceId
    const service = catalog[id]
    if (!service.active) {
      throw new PricingError('service_unavailable', `Service unavailable: ${id}`)
    }
    if (!isSubscribable(service)) {
      throw new PricingError('quote_only_service', `Service is quote-only: ${id}`)
    }
    selection.add(id)
  }

  const items: QuoteItem[] = []
  let total = 0

  for (const id of CATALOG_SERVICE_IDS) {
    if (!selection.has(id)) continue
    const amount = resolveAmount(id, catalog[id], rawConfig)
    items.push({ id, name: catalog[id].name[locale], amount })
    total += amount
  }

  if (items.length === 0 || total <= 0) {
    throw new PricingError('no_services_selected', 'Quote total is zero')
  }

  // Money hygiene: keep the total at cent precision for the charged amount.
  const rounded = Math.round(total * 100) / 100

  return {
    items,
    total: rounded,
    reason: items.map((item) => item.name).join(' + '),
    externalReference: items.map((item) => item.id).join('+'),
  }
}

/**
 * Computes the authoritative monthly quote for the selected services.
 *
 * `serviceIds` — array of catalog ids selected by the browser.
 * `config` — spec-shaped configuration, `{ [serviceId]: { monthlyAdSpend } }`
 *   for ads services. Anything else is ignored.
 * `locale` — used for the human-readable `reason` and item names.
 * `catalog` — injectable for tests (e.g. to simulate an inactive service).
 *
 * Throws `PricingError` with a machine-readable code on any invalid input.
 */
export function computeMonthlyQuote(
  serviceIds: unknown,
  config: unknown,
  locale: Locale,
  catalog: Record<CatalogServiceId, CatalogService> = SERVICES,
): PriceQuote {
  const quote = buildQuote(serviceIds, config, locale, catalog, (id, service, rawConfig) => {
    if (service.pricing.kind === 'fixed') return service.pricing.monthlyBRL
    if (service.pricing.kind === 'ads-spend') return adSpendFeeBRL(monthlyAdSpendOf(rawConfig, id))
    // quote-only services never reach this point (rejected in buildQuote).
    throw new PricingError('quote_only_service', `Service is quote-only: ${id}`)
  })
  return {
    items: quote.items.map((item) => ({ id: item.id, name: item.name, monthlyBRL: item.amount })),
    totalBRL: quote.total,
    reason: quote.reason,
    externalReference: quote.externalReference,
  }
}

/**
 * Validates a Mercado Pago preapproval `external_reference` against the
 * subscription catalog and returns the authoritative monthly total in BRL
 * that a server-created subscription of that package carries — the minimum
 * for ads-spend services (their recorded amount can be higher because the
 * fee tracks the customer's monthly spend). Returns `null` for any reference
 * this server never creates (unknown ids, quote-only services, duplicates,
 * or ids out of catalog order — `computeMonthlyQuote` always emits
 * catalog-ordered, deduplicated references).
 *
 * Used by the checkout-completion page to refuse success claims for
 * authorized preapprovals that are not bound to a checkout this site created.
 */
export function authoritativeSubscriptionTotalBRL(reference: string): number | null {
  return authoritativeSubscriptionTotal(reference, (_id, service) =>
    service.pricing.kind === 'fixed' ? service.pricing.monthlyBRL : ADS_SPEND_RULE.minimumBRL,
  )
}

/**
 * Same binding check for the en-US Stripe checkout: the reference must be a
 * valid catalog package and the floor is the sum of the fixed USD references
 * (or the 5:1 BRL conversion) plus the US$ 100 minimum fee per ads service.
 */
export function authoritativeSubscriptionTotalUSD(reference: string): number | null {
  return authoritativeSubscriptionTotal(reference, (_id, service) => {
    if (service.pricing.kind === 'fixed') {
      const usd = service.pricing.monthlyUSD ?? service.pricing.monthlyBRL / BRL_USD_REFERENCE_RATE
      return Math.round(usd * 100) / 100
    }
    return ADS_SPEND_RULE.minimumUSD
  })
}

/**
 * Shared reference validator: splits the external_reference, requires a
 * catalog-ordered, deduplicated, subscribable package, accumulates each
 * service's authoritative amount via `resolveAmount`, and rounds the total to
 * cent precision (the same money hygiene as `computeMonthlyQuote` — a float
 * drift here could refuse a valid paid checkout).
 */
function authoritativeSubscriptionTotal(
  reference: string,
  resolveAmount: (id: CatalogServiceId, service: CatalogService) => number,
): number | null {
  const ids = reference.split('+')
  if (ids.length === 0) return null
  let total = 0
  let previousPosition = -1
  for (const id of ids) {
    const service = getService(id)
    if (!service || !isSubscribable(service)) return null
    const position = CATALOG_SERVICE_IDS.indexOf(id as CatalogServiceId)
    if (position <= previousPosition) return null
    previousPosition = position
    total += resolveAmount(id as CatalogServiceId, service)
  }
  return Math.round(total * 100) / 100
}
