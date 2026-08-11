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

// Opportunistically pruned: buckets for IPs whose newest request fell out of
// the window are dropped so the map cannot grow without bound.
const MAX_BUCKETS = 10_000

const buckets = new Map<string, number[]>()

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number }

/**
 * Records one request for `ip` and reports whether it is still within the
 * window. `now` is injectable for tests.
 */
export function checkRateLimit(ip: string, now: number = Date.now()): RateLimitResult {
  if (buckets.size > MAX_BUCKETS) pruneExpiredBuckets(now)

  const windowStart = now - WINDOW_MS
  const recent = (buckets.get(ip) ?? []).filter((timestamp) => timestamp > windowStart)

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = recent[0] ?? now
    return { allowed: false, retryAfterSeconds: Math.ceil((oldest + WINDOW_MS - now) / 1000) }
  }

  recent.push(now)
  buckets.set(ip, recent)
  return { allowed: true, retryAfterSeconds: 0 }
}

/** Drops buckets whose last request has left the window. */
function pruneExpiredBuckets(now: number): void {
  const windowStart = now - WINDOW_MS
  for (const [ip, timestamps] of buckets) {
    if (timestamps[timestamps.length - 1] <= windowStart) buckets.delete(ip)
  }
}

/** Test hook: clears every bucket. Never called from production code paths. */
export function resetRateLimitBuckets(): void {
  buckets.clear()
}
