/**
 * Shared bounded in-memory dedupe for webhook events (Mercado Pago + Stripe).
 *
 * Both webhook receivers treat redeliveries the same way: an event that was
 * already processed within DEDUPE_TTL_MS is acknowledged without repeating the
 * side effect (the owner notification). One copy instead of one per webhook
 * implementation (AGENTS.md: DO create reusable code — the two modules also
 * had to stay in step on eviction and TTL).
 */

const processedEvents = new Map<string, number>()
const MAX_PROCESSED_EVENTS = 5_000
/** Redelivered events within this window are treated as already handled. */
const DEDUPE_TTL_MS = 24 * 60 * 60_000

/** True when the event was already processed (redelivery dedupe). */
export function isProcessed(key: string): boolean {
  const expiry = processedEvents.get(key)
  if (expiry === undefined) return false
  if (expiry < Date.now()) {
    processedEvents.delete(key)
    return false
  }
  return true
}

/** Marks an event as processed, bounding the map when it grows too large. */
export function markProcessed(key: string): void {
  if (processedEvents.size >= MAX_PROCESSED_EVENTS) {
    const now = Date.now()
    for (const [k, expiry] of processedEvents) {
      if (expiry < now) processedEvents.delete(k)
    }
    if (processedEvents.size >= MAX_PROCESSED_EVENTS) {
      const oldest = processedEvents.keys().next().value
      if (oldest !== undefined) processedEvents.delete(oldest)
    }
  }
  processedEvents.set(key, Date.now() + DEDUPE_TTL_MS)
}

/** Removes the dedupe marker so a redelivery can be processed again. */
export function unmarkProcessed(key: string): void {
  processedEvents.delete(key)
}

/** Clears the in-memory redelivery dedupe (test isolation). */
export function resetWebhookDedupe(): void {
  processedEvents.clear()
}
