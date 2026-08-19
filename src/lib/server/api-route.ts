/**
 * Shared request-handling plumbing for the public POST API routes:
 * `/api/checkout/subscription`, `/api/checkout/build` and `/api/contact/submit`.
 *
 * The three endpoints follow the same trust-boundary shape — parse the JSON
 * body, validate it into a typed payload, resolve the client IP for per-IP
 * abuse protection, enforce the rate limit, then run the paid upstream call —
 * and previously duplicated this boilerplate in three places. Keeping the
 * shared steps here (single source of truth) means a fix to parsing, IP
 * resolution, rate limiting or upstream error mapping lands in exactly one
 * file, and the three routes stay behaviourally identical.
 */
import { json } from '@sveltejs/kit'
import { ClientAddressError, clientIpAddress } from './client-ip.ts'
import { checkRateLimit, rateLimitKey, type RateLimitBucket } from './rate-limit.ts'

/** JSON parse outcome: the raw payload, or the 400 response to return. */
export type ParseOutcome = { payload: Record<string, unknown> } | { response: Response }

export async function parseJsonBody(request: Request): Promise<ParseOutcome> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return { response: json({ error: 'invalid_json' }, { status: 400 }) }
  }
  if (typeof body !== 'object' || body === null) {
    return { response: json({ error: 'invalid_json' }, { status: 400 }) }
  }
  return { payload: body as Record<string, unknown> }
}

/** IP resolution outcome: the client address, or the 503 response to return. */
export type AddressOutcome = { address: string } | { response: Response }

export function resolveClientAddress(getClientAddress: () => string, logTag: string): AddressOutcome {
  try {
    return { address: clientIpAddress(getClientAddress) }
  } catch (error) {
    if (error instanceof ClientAddressError) {
      // Fail loudly (AGENTS.md): without a client address we cannot rate-limit,
      // and pooling unidentified clients into one bucket would 429 unrelated
      // customers. Refuse the request instead of silently accepting it.
      console.error(`[${logTag}] cannot determine client IP for rate limiting; refusing request`)
      return { response: json({ error: 'client_address_unavailable' }, { status: 503 }) }
    }
    throw error
  }
}

/** Rate-limit outcome: proceed with the client address, or the 429 response. */
export type RateLimitOutcome = { address: string } | { response: Response }

export function rateLimitOrError(
  bucket: RateLimitBucket,
  address: string,
  logTag: string,
  rejectedWhat: string,
): RateLimitOutcome {
  const rateLimit = checkRateLimit(rateLimitKey(bucket, address))
  if (!rateLimit.allowed) {
    console.warn(`[${logTag}] rate limit exceeded; rejecting ${rejectedWhat}`)
    return {
      response: json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }),
    }
  }
  return { address }
}

/**
 * Stable HTTP status for a paid-upstream failure, mapped from the typed error
 * code. Missing credentials and timeouts are the operator's to fix (503);
 * every other upstream failure is a 502. A newly added error code still
 * produces a valid status through the 502 default — never an unhandled switch.
 */
export function upstreamErrorStatus(code: string): number {
  return code === 'missing_credentials' || code === 'timeout' ? 503 : 502
}

/** Logs an upstream-domain failure server-side and maps it to its HTTP response. */
export function upstreamErrorResponse(error: { code: string }, logTag: string, operation: string): Response {
  console.error(`[${logTag}] ${operation} failed: ${error.code}`)
  return json({ error: error.code }, { status: upstreamErrorStatus(error.code) })
}

/**
 * Standard POST handler pipeline for the public API routes:
 *
 *   parse JSON body → validate into a typed payload → resolve the client IP
 *   → enforce the per-IP rate limit → run the paid upstream call.
 *
 * Routes with an extra server-side step between validation and rate limiting
 * (e.g. subscription pricing) keep their handler inline and call the shared
 * steps directly instead.
 */
export async function handleApiPost<TPayload>(input: {
  request: Request
  getClientAddress: () => string
  logTag: string
  bucket: RateLimitBucket
  rejectedWhat: string
  validate: (payload: Record<string, unknown>) => { payload: TPayload } | { error: string }
  run: (payload: TPayload) => Promise<Response>
}): Promise<Response> {
  const parsed = await parseJsonBody(input.request)
  if ('response' in parsed) return parsed.response

  const validated = input.validate(parsed.payload)
  if ('error' in validated) return json({ error: validated.error }, { status: 400 })

  const resolved = resolveClientAddress(input.getClientAddress, input.logTag)
  if ('response' in resolved) return resolved.response

  const rateLimited = rateLimitOrError(input.bucket, resolved.address, input.logTag, input.rejectedWhat)
  if ('response' in rateLimited) return rateLimited.response

  return input.run(validated.payload)
}
