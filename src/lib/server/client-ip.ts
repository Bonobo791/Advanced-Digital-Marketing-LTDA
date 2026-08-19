/**
 * Client IP resolution for per-IP abuse protection on the public checkout
 * entry points: POST /api/checkout/subscription and the
 * /pt-br/checkout/complete/ return page. Shared so both behave identically.
 *
 * Only the platform-provided address (adapter-node populates
 * `getClientAddress` from the X-Forwarded-For header the reverse proxy sets) is
 * accepted. Proxy headers like `x-forwarded-for` and `x-real-ip` are
 * client-controllable, so trusting them would let an attacker rotate the
 * rate-limit key at will and bypass the throttle.
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
