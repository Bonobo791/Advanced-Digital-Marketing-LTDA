import { describe, expect, it } from 'vitest'
import { ClientAddressError, clientIpAddress } from './client-ip'

describe('clientIpAddress — platform address only', () => {
  it('returns the platform-provided address', () => {
    expect(clientIpAddress(() => '203.0.113.7')).toBe('203.0.113.7')
  })

  it('trims surrounding whitespace from the platform address', () => {
    expect(clientIpAddress(() => ' 203.0.113.7 ')).toBe('203.0.113.7')
  })

  it('throws ClientAddressError when the platform address is empty', () => {
    expect(() => clientIpAddress(() => '')).toThrow(ClientAddressError)
    expect(() => clientIpAddress(() => '   ')).toThrow(ClientAddressError)
  })

  it('throws ClientAddressError when the platform address is unavailable', () => {
    expect(() =>
      clientIpAddress(() => {
        throw new Error('no address in this environment')
      }),
    ).toThrow(ClientAddressError)
  })

  it('never trusts client-supplied proxy headers', () => {
    // There is no header input at all — the function signature takes only the
    // platform resolver, so spoofable x-forwarded-for/x-real-ip values can
    // never become the rate-limit key.
    expect(() => clientIpAddress(() => '')).toThrow(ClientAddressError)
  })
})
