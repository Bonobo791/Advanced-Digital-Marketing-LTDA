/**
 * Browser-side contact-form submission contract (src/lib/client/contact.ts).
 *
 * The client must never invent success: a 200 response is only success when
 * it carries the server-computed expiry, and anything else is a loud failure
 * (AGENTS.md: no silent fallbacks).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { submitContactForm } from './contact'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('submitContactForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns the server-computed expiry on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: true, expiresInHours: 72 })))
    await expect(submitContactForm('/api/contact/submit', {})).resolves.toEqual({
      ok: true,
      expiresInHours: 72,
    })
  })

  it('treats a malformed success response as a failure instead of inventing a fallback', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: true })))
      await expect(submitContactForm('/api/contact/submit', {})).resolves.toEqual({
        ok: false,
        errorCode: 'invalid_response',
      })
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('malformed success response'), expect.any(Object))
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('rejects non-object JSON bodies (null, arrays, primitives) without throwing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      for (const body of [null, [1, 2], 'ok', 42]) {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(body)))
        await expect(submitContactForm('/api/contact/submit', {})).resolves.toEqual({
          ok: false,
          errorCode: 'invalid_response',
        })
      }
      expect(errorSpy).toHaveBeenCalled()
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('requires a finite positive expiresInHours on success', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      for (const expiresInHours of [0, -1, Number.NaN, Infinity, '72', null]) {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(jsonResponse({ ok: true, expiresInHours })),
        )
        await expect(submitContactForm('/api/contact/submit', {})).resolves.toEqual({
          ok: false,
          errorCode: 'invalid_response',
        })
      }
      expect(errorSpy).toHaveBeenCalled()
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('maps error responses to their stable error code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid_email' }, 400)))
    await expect(submitContactForm('/api/contact/submit', {})).resolves.toEqual({
      ok: false,
      errorCode: 'invalid_email',
    })
  })
})
