import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { CRON_SECRET_HEADER, isCronAuthorized } from './cron'

const token = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
    minLength: 1,
    maxLength: 32,
  })
  .map((characters) => characters.join(''))

describe('cron authorization', () => {
  it('accepts only the exact configured secret', () => {
    fc.assert(
      fc.property(token, token, (expectedSecret, receivedSecret) => {
        const request = new Request('http://localhost/api/cron', {
          headers: { [CRON_SECRET_HEADER]: receivedSecret },
        })

        return isCronAuthorized(request, expectedSecret) === (expectedSecret === receivedSecret)
      }),
    )
  })

  it('rejects missing configuration and missing headers', () => {
    const request = new Request('http://localhost/api/cron')

    expect(isCronAuthorized(request, undefined)).toBe(false)
    expect(isCronAuthorized(request, 'configured-secret')).toBe(false)
  })
})
