/**
 * Client-side order status helpers for the checkout result pages.
 * The success page must verify against the backend — never trust the URL.
 */

export interface PublicOrder {
  id: string
  productId: string
  productName: string
  currency: string
  amountCents: number
  status: string
  createdAt: string
  updatedAt: string
}

export const TERMINAL_STATUSES = ['approved', 'rejected', 'refunded'] as const

export async function fetchOrder(orderId: string): Promise<PublicOrder | null> {
  const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`)
  if (!response.ok) return null
  return (await response.json()) as PublicOrder
}

/**
 * Polls the order until it reaches a terminal status or the timeout elapses.
 * Returns a stop function.
 */
export function pollOrder(
  orderId: string,
  onUpdate: (order: PublicOrder | null) => void,
  intervalMs = 5000,
  timeoutMs = 10 * 60 * 1000,
): () => void {
  const startedAt = Date.now()
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const tick = async () => {
    if (stopped) return
    const order = await fetchOrder(orderId)
    onUpdate(order)
    const terminal = order !== null && (TERMINAL_STATUSES as readonly string[]).includes(order.status)
    if (!terminal && !stopped && Date.now() - startedAt < timeoutMs) {
      timer = setTimeout(tick, intervalMs)
    }
  }

  void tick()

  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
  }
}
