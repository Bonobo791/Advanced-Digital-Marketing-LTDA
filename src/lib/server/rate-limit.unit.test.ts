import { beforeEach, describe, expect, it } from 'vitest'
import {
  checkRateLimit,
  rateLimitBucketCount,
  resetRateLimitBuckets,
} from './rate-limit'

const NOW = 1_000_000
const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 10
const MAX_BUCKETS = 10_000

beforeEach(() => {
  resetRateLimitBuckets()
})

describe('checkRateLimit — per-IP sliding window', () => {
  it('allows up to MAX_REQUESTS_PER_WINDOW requests inside the window', () => {
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
      expect(checkRateLimit('ip-a', NOW).allowed).toBe(true)
    }
    expect(rateLimitBucketCount()).toBe(1)
  })

  it('rejects the request that exceeds the window, with retryAfterSeconds', () => {
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
      checkRateLimit('ip-a', NOW)
    }
    const result = checkRateLimit('ip-a', NOW)
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBe(Math.ceil(WINDOW_MS / 1000))
  })

  it('lets a client through again once its timestamps leave the window', () => {
    checkRateLimit('ip-a', NOW)
    expect(checkRateLimit('ip-a', NOW + WINDOW_MS + 1).allowed).toBe(true)
  })

  it('tracks distinct IPs in separate buckets', () => {
    checkRateLimit('ip-a', NOW)
    checkRateLimit('ip-b', NOW)
    checkRateLimit('ip-a', NOW)
    expect(rateLimitBucketCount()).toBe(2)
  })
})

describe('checkRateLimit — MAX_BUCKETS cap', () => {
  it('never exceeds the cap when a flood of distinct IPs arrives', () => {
    for (let i = 0; i < MAX_BUCKETS; i++) {
      checkRateLimit(`ip-${i}`, NOW)
    }
    expect(rateLimitBucketCount()).toBe(MAX_BUCKETS)

    for (let i = 0; i < 1_000; i++) {
      expect(checkRateLimit(`flood-${i}`, NOW).allowed).toBe(true)
    }
    expect(rateLimitBucketCount()).toBe(MAX_BUCKETS)
  })

  it('evicts the oldest-inserted bucket to make room for a new IP', () => {
    // ip-0 fills its own window first, so it is observable: if its bucket
    // survives, its next request is rejected; if evicted, it is allowed again.
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
      checkRateLimit('ip-0', NOW)
    }
    for (let i = 1; i < MAX_BUCKETS; i++) {
      checkRateLimit(`ip-${i}`, NOW)
    }
    expect(rateLimitBucketCount()).toBe(MAX_BUCKETS)

    // The new IP forces one eviction; FIFO order evicts the first-inserted
    // bucket (ip-0), which therefore gets a fresh window.
    expect(checkRateLimit('flood-0', NOW).allowed).toBe(true)
    expect(rateLimitBucketCount()).toBe(MAX_BUCKETS)
    expect(checkRateLimit('ip-0', NOW).allowed).toBe(true)
    expect(rateLimitBucketCount()).toBe(MAX_BUCKETS)
  })

  it('prefers dropping an expired bucket over evicting an active one', () => {
    // One bucket is already outside the window; the rest are active.
    checkRateLimit('expired-ip', NOW - WINDOW_MS - 1)
    for (let i = 0; i < MAX_BUCKETS - 1; i++) {
      checkRateLimit(`ip-${i}`, NOW)
    }
    expect(rateLimitBucketCount()).toBe(MAX_BUCKETS)

    expect(checkRateLimit('flood-0', NOW).allowed).toBe(true)
    expect(rateLimitBucketCount()).toBe(MAX_BUCKETS)

    // The expired bucket was the one dropped: the IP is treated as a new
    // client (allowed again) and the active buckets survived.
    expect(checkRateLimit('expired-ip', NOW).allowed).toBe(true)
    expect(rateLimitBucketCount()).toBe(MAX_BUCKETS)
  })

  it('reuses an existing bucket at capacity without evicting anyone', () => {
    // ip-0 fills its own window (observable), one bucket is fully expired.
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
      checkRateLimit('ip-0', NOW)
    }
    for (let i = 1; i < MAX_BUCKETS - 1; i++) {
      checkRateLimit(`ip-${i}`, NOW)
    }
    checkRateLimit('expired-ip', NOW - WINDOW_MS - 1)
    expect(rateLimitBucketCount()).toBe(MAX_BUCKETS)

    // The expired IP is still tracked, so its request reuses its own bucket
    // instead of evicting a slot from a live client.
    expect(checkRateLimit('expired-ip', NOW).allowed).toBe(true)
    expect(rateLimitBucketCount()).toBe(MAX_BUCKETS)

    // The live bucket that was at its per-IP limit is untouched.
    expect(checkRateLimit('ip-0', NOW).allowed).toBe(false)
  })
})
