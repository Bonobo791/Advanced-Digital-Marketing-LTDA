/**
 * Browser-side analytics hook for checkout events.
 *
 * Pushes a `begin_checkout` event to `window.dataLayer` when Google Tag
 * Manager is present; a no-op (logged with console.info) otherwise. Shared by
 * the subscription configurator and the one-time website build purchase.
 */
export function fireBeginCheckout(items: { item_id: string; item_name: string }[], value: number): void {
  if (typeof window === 'undefined') return
  const dataLayer = (window as unknown as { dataLayer?: unknown[] }).dataLayer
  if (!Array.isArray(dataLayer)) {
    console.info('[checkout] analytics: no dataLayer found; begin_checkout was not fired')
    return
  }
  dataLayer.push({ event: 'begin_checkout', currency: 'BRL', value, items })
}
