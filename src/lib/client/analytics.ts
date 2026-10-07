/**
 * Browser-side analytics initialization and checkout events.
 *
 * Pushes a `begin_checkout` event to `window.dataLayer` when Google Tag
 * Manager is present; a no-op (logged with console.info) otherwise. Shared by
 * the subscription configurator and the one-time website build purchase.
 */
import type { BeforeNavigate } from '@sveltejs/kit'
import { analyticsReferrer, isSensitiveAnalyticsUrl } from '$lib/analytics-privacy'

const MEASUREMENT_ID = 'G-ZREVRSHYJA'
const SCRIPT_ID = 'adm-google-tag'

type AnalyticsWindow = Window & {
  dataLayer?: unknown[]
  gtag?: (...parameters: unknown[]) => void
}

/** Called during layout initialization, before checkout child effects run. */
export function initializeAnalytics(): boolean {
  if (typeof window === 'undefined' || isSensitiveAnalyticsUrl(new URL(window.location.href))) return false
  if (document.getElementById(SCRIPT_ID)) return true

  const browser = window as AnalyticsWindow
  const layer = Array.isArray(browser.dataLayer) ? browser.dataLayer : []
  browser.dataLayer = layer
  browser.gtag = function (..._parameters: unknown[]) {
    layer.push(arguments)
  }
  // Configure before the script can execute. Default pageviews/history tracking
  // remain available only within safe documents; excluded routes always reload.
  browser.gtag('js', new Date())
  browser.gtag('config', MEASUREMENT_ID, { page_referrer: analyticsReferrer(document.referrer) })

  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.async = true
  script.referrerPolicy = 'no-referrer'
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
  script.onerror = () => console.warn('[analytics] Google tag failed to load')
  document.head.appendChild(script)
  return true
}

/**
 * Keep loaded tags out of contact documents, including on browser Back/Forward.
 * Both sides reload so excluded URLs never enter a tracked document's history.
 * send_page_view:false alone would still allow GA enhanced history measurements.
 */
export function protectAnalyticsNavigation(navigation: Pick<BeforeNavigate, 'from' | 'to' | 'willUnload' | 'cancel'>): void {
  if (navigation.willUnload || !navigation.to) return
  if (!isSensitiveAnalyticsUrl(navigation.to.url)
    && (!navigation.from || !isSensitiveAnalyticsUrl(navigation.from.url))) return

  navigation.cancel()
  window.location.assign(navigation.to.url.href)
}

function dataLayer(): unknown[] | undefined {
  if (typeof window === 'undefined') return undefined
  if (isSensitiveAnalyticsUrl(new URL(window.location.href))) return undefined
  const layer = (window as unknown as { dataLayer?: unknown[] }).dataLayer
  return Array.isArray(layer) ? layer : undefined
}

/**
 * Shared purchase-conversion push. Only ever called with a server-verified
 * payment/subscription (the return page's live Mercado Pago / Stripe check) —
 * never from the browser on its own. Returns false when no dataLayer exists
 * (logged loudly) or when the event was already fired for this id.
 */
export function firePurchase(input: {
  orderId: string
  value: number
  currency: 'BRL' | 'USD'
  items: { item_id: string; item_name: string }[]
}): boolean {
  const layer = dataLayer()
  if (!layer) {
    console.info('[checkout] analytics: no dataLayer found; purchase was not fired')
    return false
  }
  layer.push({
    event: 'purchase',
    currency: input.currency,
    value: input.value,
    transaction_id: input.orderId,
    items: input.items,
  })
  return true
}

export function fireBeginCheckout(items: { item_id: string; item_name: string }[], value: number, currency: 'BRL' | 'USD' = 'BRL'): void {
  const layer = dataLayer()
  if (!layer) {
    console.info('[checkout] analytics: no dataLayer found; begin_checkout was not fired')
    return
  }
  layer.push({ event: 'begin_checkout', currency, value, items })
}
