/**
 * Best-effort in-memory rate limiter for the public checkout entry points.
 *
 * The POST /api/checkout/subscription handler is unauthenticated and calls a
 * paid third-party API on every accepted request, so a scripted flood could
 * create unbounded Mercado Pago preapprovals. This limiter caps accepted
 * requests per bucket key inside a sliding window and rejects the rest with
 * HTTP 429.
 *
 * Keys are built by `rateLimitKey` from a named endpoint bucket and the client
 * IP: each entry point gets its own bucket, so traffic on one endpoint never
 * exhausts the budget that guards another (a customer redirected back from
 * Mercado Pago must not consume the budget that protects the paid
 * subscription-creation call, and vice versa).
 *
 * LIMITATION (deliberate and documented): the Node server may be restarted —
 * each warm instance keeps its OWN in-memory bucket, so this is a
 * per-instance throttle, not a global limit. It raises the cost of abuse
 * without adding infrastructure; if real abuse appears, replace it with a
 * shared store (or a platform/WAF limit). The limiter fails loud: every
 * rejected request is logged server-side.
 */

const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 10

// Hard cap on tracked bucket keys. When the map is at capacity and a new key
// needs a bucket, one slot is freed (expired buckets first, then the
// oldest-inserted) so the map can never grow without bound.
const MAX_BUCKETS = 10_000

const buckets = new Map<string, number[]>()

/**
 * Named buckets for the public checkout entry points. Each gets an isolated
 * per-IP window, keyed as `<bucket>:<ip>`.
 */
export const RATE_LIMIT_BUCKETS = {
  subscriptionCreate: 'subscription-create',
  subscriptionVerify: 'subscription-verify',
  buildCreate: 'build-create',
  paymentVerify: 'payment-verify',
  contactSubmit: 'contact-submit',
  stripeCreate: 'stripe-create',
  stripeVerify: 'stripe-verify',
} as const

export type RateLimitBucket = keyof typeof RATE_LIMIT_BUCKETS

/**
 * Builds the opaque bucket key for one entry point and client address.
 * The IP is embedded in the key, so distinct clients never share a bucket.
 */
export function rateLimitKey(bucket: RateLimitBucket, ip: string): string {
  return `${RATE_LIMIT_BUCKETS[bucket]}:${ip}`
}

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number }

/**
 * Records one request for `bucketKey` and reports whether it is still within
 * the window. `now` is injectable for tests.
 */
export function checkRateLimit(bucketKey: string, now: number = Date.now()): RateLimitResult {
  const windowStart = now - WINDOW_MS
  const existing = buckets.get(bucketKey)
  const recent = existing ? existing.filter((timestamp) => timestamp > windowStart) : []

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = recent[0] ?? now
    return { allowed: false, retryAfterSeconds: Math.ceil((oldest + WINDOW_MS - now) / 1000) }
  }

  // A brand-new bucket key needs a bucket: free a slot before inserting so the
  // cap is a hard bound. Existing keys (even with fully expired timestamps)
  // reuse their bucket and never force an eviction.
  if (!existing && buckets.size >= MAX_BUCKETS) {
    makeRoom(now)
  }

  recent.push(now)
  buckets.set(bucketKey, recent)
  return { allowed: true, retryAfterSeconds: 0 }
}

/**
 * Frees one bucket for a new key when the map is at capacity. First drops any
 * bucket whose last request has left the window; when every bucket is still
 * active inside the window, evicts the oldest-inserted one (Map preserves
 * insertion order, so this is O(1)). The map therefore never exceeds
 * MAX_BUCKETS, and a flood of distinct keys cannot grow memory or turn every
 * request into an O(n) scan of an oversized map.
 */
function makeRoom(now: number): void {
  const windowStart = now - WINDOW_MS
  for (const [bucketKey, timestamps] of buckets) {
    const last = timestamps.at(-1)
    if (last !== undefined && last <= windowStart) {
      buckets.delete(bucketKey)
      return
    }
  }
  const oldest = buckets.keys().next()
  if (!oldest.done) buckets.delete(oldest.value)
}

/** Test hook: clears every bucket. Never called from production code paths. */
export function resetRateLimitBuckets(): void {
  buckets.clear()
}

/** Test hook: number of tracked buckets. Never called from production code paths. */
export function rateLimitBucketCount(): number {
  return buckets.size
}
