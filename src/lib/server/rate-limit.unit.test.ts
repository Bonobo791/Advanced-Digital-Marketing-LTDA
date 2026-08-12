import { beforeEach, describe, expect, it } from 'vitest'
import {
  checkRateLimit,
  rateLimitBucketCount,
  rateLimitKey,
  resetRateLimitBuckets,
} from './rate-limit'

const NOW = 1_000_000
const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 10
const MAX_BUCKETS = 10_000

/** Key for a given endpoint/IP pair, mirroring production call sites. */
const createKey = (ip: string) => rateLimitKey('subscriptionCreate', ip)
const verifyKey = (ip: string) => rateLimitKey('subscriptionVerify', ip)

beforeEach(() => {
  resetRateLimitBuckets()
})

describe('rateLimitKey — per-endpoint bucket keys', () => {
  it('embeds the endpoint bucket and the client IP', () => {
    expect(createKey('203.0.113.7')).toBe('subscription-create:203.0.113.7')
    expect(verifyKey('203.0.113.7')).toBe('subscription-verify:203.0.113.7')
  })

  it('gives distinct endpoints separate buckets for the same IP', () => {
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
      checkRateLimit(createKey('ip-a'), NOW)
    }
    // The create bucket is exhausted, but verify traffic from the same client
    // is untouched — a redirected customer is never punished for their own
    // checkout, and a verify flood cannot starve subscription creation.
    expect(checkRateLimit(verifyKey('ip-a'), NOW).allowed).toBe(true)
    expect(checkRateLimit(createKey('ip-a'), NOW).allowed).toBe(false)
  })
})

describe('checkRateLimit — per-IP sliding window', () => {
  it('allows up to MAX_REQUESTS_PER_WINDOW requests inside the window', () => {
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
      expect(checkRateLimit(createKey('ip-a'), NOW).allowed).toBe(true)
    }
    expect(rateLimitBucketCount()).toBe(1)
  })

  it('rejects the request that exceeds the window, with retryAfterSeconds', () => {
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
      checkRateLimit(createKey('ip-a'), NOW)
    }
    const result = checkRateLimit(createKey('ip-a'), NOW)
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBe(Math.ceil(WINDOW_MS / 1000))
  })

  it('lets a client through again once its timestamps leave the window', () => {
    checkRateLimit(createKey('ip-a'), NOW)
    expect(checkRateLimit(createKey('ip-a'), NOW + WINDOW_MS + 1).allowed).toBe(true)
  })

  it('tracks distinct IPs in separate buckets', () => {
    checkRateLimit(createKey('ip-a'), NOW)
    checkRateLimit(createKey('ip-b'), NOW)
    checkRateLimit(createKey('ip-a'), NOW)
    expect(rateLimitBucketCount()).toBe(2)
  })
})

describe('checkRateLimit — MAX_BUCKETS cap', () => {
  it('never exceeds the cap when a flood of distinct IPs arrives', () => {
    for (let i = 0; i < MAX_BUCKETS; i++) {
      checkRateLimit(createKey(`ip-${i}`), NOW)
    }
    expect(rateLimitBucketCount()).toBe(MAX_BUCKETS)

    for (let i = 0; i < 1_000; i++) {
      expect(checkRateLimit(createKey(`flood-${i}`), NOW).allowed).toBe(true)
    }
    expect(rateLimitBucketCount()).toBe(MAX_BUCKETS)
  })

  it('evicts the oldest-inserted bucket to make room for a new IP', () => {
    // ip-0 fills its own window first, so it is observable: if its bucket
    // survives, its next request is rejected; if evicted, it is allowed again.
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
      checkRateLimit(createKey('ip-0'), NOW)
    }
    for (let i = 1; i < MAX_BUCKETS; i++) {
      checkRateLimit(createKey(`ip-${i}`), NOW)
    }
    expect(rateLimitBucketCount()).toBe(MAX_BUCKETS)

    // The new IP forces one eviction; FIFO order evicts the first-inserted
    // bucket (ip-0), which therefore gets a fresh window.
    expect(checkRateLimit(createKey('flood-0'), NOW).allowed).toBe(true)
    expect(rateLimitBucketCount()).toBe(MAX_BUCKETS)
    expect(checkRateLimit(createKey('ip-0'), NOW).allowed).toBe(true)
    expect(rateLimitBucketCount()).toBe(MAX_BUCKETS)
  })

  it('prefers dropping an expired bucket over evicting an active one', () => {
    // One bucket is already outside the window; the rest are active.
    checkRateLimit(createKey('expired-ip'), NOW - WINDOW_MS - 1)
    for (let i = 0; i < MAX_BUCKETS - 1; i++) {
      checkRateLimit(createKey(`ip-${i}`), NOW)
    }
    expect(rateLimitBucketCount()).toBe(MAX_BUCKETS)

    expect(checkRateLimit(createKey('flood-0'), NOW).allowed).toBe(true)
    expect(rateLimitBucketCount()).toBe(MAX_BUCKETS)

    // The expired bucket was the one dropped: the IP is treated as a new
    // client (allowed again) and the active buckets survived.
    expect(checkRateLimit(createKey('expired-ip'), NOW).allowed).toBe(true)
    expect(rateLimitBucketCount()).toBe(MAX_BUCKETS)
  })

  it('reuses an existing bucket at capacity without evicting anyone', () => {
    // ip-0 fills its own window (observable), one bucket is fully expired.
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
      checkRateLimit(createKey('ip-0'), NOW)
    }
    for (let i = 1; i < MAX_BUCKETS - 1; i++) {
      checkRateLimit(createKey(`ip-${i}`), NOW)
    }
    checkRateLimit(createKey('expired-ip'), NOW - WINDOW_MS - 1)
    expect(rateLimitBucketCount()).toBe(MAX_BUCKETS)

    // The expired IP is still tracked, so its request reuses its own bucket
    // instead of evicting a slot from a live client.
    expect(checkRateLimit(createKey('expired-ip'), NOW).allowed).toBe(true)
    expect(rateLimitBucketCount()).toBe(MAX_BUCKETS)

    // The live bucket that was at its per-IP limit is untouched.
    expect(checkRateLimit(createKey('ip-0'), NOW).allowed).toBe(false)
  })
})
