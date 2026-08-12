/**
 * Marketing attribution captured on first landing and attached to the order
 * before the customer is sent to payment.
 *
 * This module is isomorphic (safe to import on server and client). The
 * localStorage helpers are guarded so they are no-ops outside the browser.
 */

export interface Attribution {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  gclid?: string
  gbraid?: string
  wbraid?: string
  fbclid?: string
  landingPage?: string
  referrer?: string
}

const QUERY_PARAM_KEYS: ReadonlyArray<readonly [keyof Attribution, string]> = [
  ['utmSource', 'utm_source'],
  ['utmMedium', 'utm_medium'],
  ['utmCampaign', 'utm_campaign'],
  ['utmContent', 'utm_content'],
  ['utmTerm', 'utm_term'],
  ['gclid', 'gclid'],
  ['gbraid', 'gbraid'],
  ['wbraid', 'wbraid'],
  ['fbclid', 'fbclid'],
]

const STORAGE_KEY = 'adm:attribution'

/** Extracts UTM / click-id parameters from a URL (pure, no side effects). */
export function parseAttribution(url: URL): Attribution {
  const attribution: Attribution = {}
  for (const [key, param] of QUERY_PARAM_KEYS) {
    const value = url.searchParams.get(param)
    if (value) attribution[key] = value
  }
  return attribution
}

const MAX_FIELD_LENGTH = 512

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, MAX_FIELD_LENGTH)
}

/**
 * Validates an attribution object coming from an API body: keeps only the
 * known keys, trims and length-caps every value. Returns undefined when the
 * payload has none of the known keys.
 */
export function sanitizeAttribution(input: unknown): Attribution | undefined {
  if (typeof input !== 'object' || input === null) return undefined
  const source = input as Record<string, unknown>
  const attribution: Attribution = {}
  for (const [key, param] of QUERY_PARAM_KEYS) {
    const value = cleanString(source[param] ?? source[key])
    if (value) attribution[key] = value
  }
  const landingPage = cleanString(source.landingPage ?? source.landing_page)
  if (landingPage) attribution.landingPage = landingPage
  const referrer = cleanString(source.referrer)
  if (referrer) attribution.referrer = referrer
  return Object.keys(attribution).length > 0 ? attribution : undefined
}

/** Reads the persisted attribution, if any (browser only). */
export function readStoredAttribution(): Attribution | undefined {
  if (typeof localStorage === 'undefined') return undefined
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    return sanitizeAttribution(JSON.parse(raw) as unknown)
  } catch {
    console.warn('[attribution] getItem failed; treating as no stored attribution')
    return undefined
  }
}

/**
 * First-touch attribution capture: stores the landing page, referrer and any
 * UTM / click-id parameters the first time the visitor lands, then never
 * overwrites them. Safe to call repeatedly (e.g. on every page load).
 */
export function captureAttribution(): Attribution | undefined {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return undefined
  }
  const existing = readStoredAttribution()
  if (existing) return existing

  const url = new URL(window.location.href)
  const attribution: Attribution = parseAttribution(url)
  attribution.landingPage = `${url.pathname}${url.search}`.slice(0, MAX_FIELD_LENGTH)
  const referrer = cleanString(document.referrer)
  if (referrer) attribution.referrer = referrer

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution))
  } catch {
    // Persistence is the whole point of first-touch capture: the caller
    // (layout) ignores the returned object, so a silent failure would drop
    // the campaign data with no signal and later order attribution would be
    // wrong. Fail loud instead (blocked storage / quota in private mode).
    console.warn('[attribution] setItem failed; first-touch attribution not persisted')
  }
  return attribution
}
