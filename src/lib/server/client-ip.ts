/**
 * Client IP resolution for per-IP abuse protection on the public checkout
 * entry points: POST /api/checkout/subscription and the
 * /pt-br/checkout/complete/ return page. Shared so both behave identically.
 *
 * Only the platform-provided address is accepted: with adapter-node,
 * `getClientAddress` returns the socket address UNLESS the deployment
 * configures `ADDRESS_HEADER=X-Forwarded-For` (and `XFF_DEPTH` for the number
 * of trusted proxies in front of the app) — the Coolify docs cover this,
 * because without it every visitor shares the proxy address and the per-IP
 * rate limiter would throttle the whole site together. Proxy headers are
 * never trusted here directly: `x-forwarded-for`/`x-real-ip` are
 * client-controllable, so reading them ourselves would let an attacker rotate
 * the rate-limit key at will and bypass the throttle.
 *
 * Fails loudly when no address is available (AGENTS.md: no silent fallbacks) —
 * returning a shared placeholder like 'unknown' would pool every unidentified
 * client into one rate-limit bucket and let a few requests exhaust it for
 * everyone.
 */
export class ClientAddressError extends Error {
  constructor() {
    super('Cannot determine client IP address for rate limiting')
    this.name = 'ClientAddressError'
  }
}

export function clientIpAddress(getClientAddress: () => string): string {
  try {
    const address = getClientAddress()
    const trimmed = address?.trim()
    if (trimmed) return trimmed
  } catch {
    // Fall through to the loud failure below.
  }
  throw new ClientAddressError()
}
