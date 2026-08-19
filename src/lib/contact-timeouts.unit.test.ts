/**
 * Guards the contact-form timeout invariant: the browser-side abort timer must
 * be comfortably LONGER than the server's MailJet request timeout — same
 * reasoning as the checkout timers (see checkout-timeouts.unit.test.ts).
 */
import { CONTACT_REQUEST_TIMEOUT_MS } from '$lib/constants'
import { MAILJET_REQUEST_TIMEOUT_MS } from '$lib/server/mailjet'
import { describe, expect, it } from 'vitest'

describe('contact-form timeouts', () => {
  it('leaves headroom for the browser → function → MailJet round-trip', () => {
    expect(CONTACT_REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(MAILJET_REQUEST_TIMEOUT_MS * 2)
  })
})
