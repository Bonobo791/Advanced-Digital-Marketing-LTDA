/**
 * Best-effort in-memory per-IP rate limiter for the public checkout endpoint.
 *
 * The POST /api/checkout/subscription handler is unauthenticated and calls a
 * paid third-party API on every accepted request, so a scripted flood could
 * create unbounded Mercado Pago preapprovals. This limiter caps accepted
 * requests per client IP inside a sliding window and rejects the rest with
 * HTTP 429.
 *
 * LIMITATION (deliberate and documented): Netlify Functions are serverless —
 * each warm instance keeps its OWN in-memory bucket, so this is a
 * per-instance throttle, not a global limit. It raises the cost of abuse
 * without adding infrastructure; if real abuse appears, replace it with a
 * shared store (or a platform/WAF limit). The limiter fails loud: every
 * rejected request is logged server-side.
 */

const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 10

// Hard cap on tracked client IPs. When the map is at capacity and a new IP
// needs a bucket, one slot is freed (expired buckets first, then the
// oldest-inserted) so the map can never grow without bound.
const MAX_BUCKETS = 10_000

const buckets = new Map<string, number[]>()

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number }

/**
 * Records one request for `ip` and reports whether it is still within the
 * window. `now` is injectable for tests.
 */
export function checkRateLimit(ip: string, now: number = Date.now()): RateLimitResult {
  const windowStart = now - WINDOW_MS
  const existing = buckets.get(ip)
  const recent = existing ? existing.filter((timestamp) => timestamp > windowStart) : []

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = recent[0] ?? now
    return { allowed: false, retryAfterSeconds: Math.ceil((oldest + WINDOW_MS - now) / 1000) }
  }

  // A brand-new client IP needs a bucket: free a slot before inserting so the
  // cap is a hard bound. Existing IPs (even with fully expired timestamps)
  // reuse their bucket and never force an eviction.
  if (!existing && buckets.size >= MAX_BUCKETS) {
    makeRoom(now)
  }

  recent.push(now)
  buckets.set(ip, recent)
  return { allowed: true, retryAfterSeconds: 0 }
}

/**
 * Frees one bucket for a new client IP when the map is at capacity. First
 * drops any bucket whose last request has left the window; when every bucket
 * is still active inside the window, evicts the oldest-inserted one (Map
 * preserves insertion order, so this is O(1)). The map therefore never
 * exceeds MAX_BUCKETS, and a flood of distinct IPs cannot grow memory or turn
 * every request into an O(n) scan of an oversized map.
 */
function makeRoom(now: number): void {
  const windowStart = now - WINDOW_MS
  for (const [ip, timestamps] of buckets) {
    if (timestamps[timestamps.length - 1] <= windowStart) {
      buckets.delete(ip)
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
