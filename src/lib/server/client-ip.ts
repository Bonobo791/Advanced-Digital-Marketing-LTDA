/**
 * Client IP resolution for per-IP abuse protection on the public checkout
 * entry points: POST /api/checkout/subscription and the
 * /pt-br/checkout/complete/ return page. Shared so both behave identically.
 *
 * Prefers the platform-provided address (adapter-netlify populates
 * `getClientAddress`); falls back to the first `x-forwarded-for` hop, then
 * `x-real-ip`.
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

export function clientIpAddress(
  getClientAddress: () => string,
  request: Request,
): string {
  try {
    const address = getClientAddress()
    if (address && address.trim()) return address
  } catch {
    // Fall through to the proxy headers below.
  }
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  throw new ClientAddressError()
}
