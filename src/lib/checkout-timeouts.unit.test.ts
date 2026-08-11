/**
 * Guards the checkout timeout invariant: the browser-side abort timer must be
 * comfortably LONGER than the server's Mercado Pago request timeout.
 *
 * The client clock starts when the browser issues the fetch and therefore
 * also covers browser→function latency and server processing; if it were equal
 * to or shorter than the server timeout it could fire right as the server
 * returns the checkout URL, turning a successful preapproval into a generic
 * failure (see P2 comment on SubscribeSection.svelte).
 */
import { CHECKOUT_REQUEST_TIMEOUT_MS } from '$lib/constants'
import { REQUEST_TIMEOUT_MS } from '$lib/server/mercadoPago'
import { describe, expect, it } from 'vitest'

describe('checkout timeouts', () => {
  it('leaves headroom for the browser → function → Mercado Pago round-trip', () => {
    // "Comfortably longer": at least 2× the upstream budget. 15s server →
    // 30s client, so a stalled upstream call still reaches the server's own
    // error handling before the browser gives up.
    expect(CHECKOUT_REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(REQUEST_TIMEOUT_MS * 2)
  })
})
