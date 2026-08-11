/**
 * Authoritative subscription pricing (spec §4).
 *
 * The browser sends only selections and configuration; this module
 * independently recalculates every price from the server-side catalog. A
 * client-supplied total is never accepted — the trust boundary is:
 * browser picks services, server prices them, Mercado Pago bills them.
 */
import {
  CATALOG_SERVICE_IDS,
  SERVICES,
  adSpendFeeBRL,
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

/** Upper bound for a monthly ad-spend figure, to keep values sane. */
const MAX_MONTHLY_AD_SPEND = 1_000_000

/**
 * Validates a `monthlyAdSpend` configuration value. Accepts a finite number
 * between 0 and MAX_MONTHLY_AD_SPEND (a R$ 0 spend still pays the R$ 500
 * minimum management fee).
 */
function isValidAdSpend(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_MONTHLY_AD_SPEND
}

/**
 * Resolves the monthly BRL amount for ONE selected service, applying the
 * fixed-price and ad-spend rules (including ad-spend validation). Kept out of
 * `computeMonthlyQuote` so the accumulation loop stays flat and the function
 * stays below the complexity gate.
 */
function resolveLineItem(
  id: CatalogServiceId,
  service: CatalogService,
  rawConfig: Record<string, unknown>,
  locale: Locale,
): LineItem {
  const name = service.name[locale]

  if (service.pricing.kind === 'fixed') {
    return { id, name, monthlyBRL: service.pricing.monthlyBRL }
  }

  if (service.pricing.kind === 'ads-spend') {
    const perService = rawConfig[id]
    const monthlyAdSpend =
      typeof perService === 'object' && perService !== null
        ? (perService as Record<string, unknown>).monthlyAdSpend
        : undefined
    if (!isValidAdSpend(monthlyAdSpend)) {
      throw new PricingError('invalid_ad_spend', `Invalid monthly ad spend for ${id}`)
    }
    return { id, name, monthlyBRL: adSpendFeeBRL(monthlyAdSpend) }
  }

  // quote-only services never reach this point (rejected in computeMonthlyQuote).
  throw new PricingError('quote_only_service', `Service is quote-only: ${id}`)
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

  const items: LineItem[] = []
  let totalBRL = 0

  for (const id of CATALOG_SERVICE_IDS) {
    if (!selection.has(id)) continue
    const item = resolveLineItem(id, catalog[id], rawConfig, locale)
    items.push(item)
    totalBRL += item.monthlyBRL
  }

  if (items.length === 0 || totalBRL <= 0) {
    throw new PricingError('no_services_selected', 'Quote total is zero')
  }

  // Money hygiene: keep the total at cent precision for `transaction_amount`.
  totalBRL = Math.round(totalBRL * 100) / 100

  const externalReference = items.map((item) => item.id).join('+')

  return {
    items,
    totalBRL,
    reason: items.map((item) => item.name).join(' + '),
    externalReference,
  }
}
