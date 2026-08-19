/**
 * Browser-side analytics hook for checkout events.
 *
 * Pushes a `begin_checkout` event to `window.dataLayer` when Google Tag
 * Manager is present; a no-op (logged with console.info) otherwise. Shared by
 * the subscription configurator and the one-time website build purchase.
 */
function dataLayer(): unknown[] | undefined {
  if (typeof window === 'undefined') return undefined
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
