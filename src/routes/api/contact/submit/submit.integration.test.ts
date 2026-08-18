import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './+server'
import { MailjetError, sendMailjetMessage } from '$lib/server/mailjet'
import { resetRateLimitBuckets } from '$lib/server/rate-limit'
import { resetProcessedVerifications } from '$lib/server/contact'

vi.mock('$lib/server/mailjet', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/server/mailjet')>()
  return { ...actual, sendMailjetMessage: vi.fn() }
})

const mockSend = vi.mocked(sendMailjetMessage)

const requestEvent = (body: unknown) =>
  ({
    request: new Request('http://localhost/api/contact/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    getClientAddress: () => '127.0.0.1',
  }) as Parameters<typeof POST>[0]

const validBody = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  consent: true,
  locale: 'en-US',
}

describe('POST /api/contact/submit', () => {
  beforeEach(() => {
    vi.stubEnv('CONTACT_FORM_TOKEN_SECRET', 'unit-test-secret-that-is-long-enough-32-bytes')
    vi.stubEnv('PUBLIC_SITE_URL', 'https://advanceddigitalmarketingltda.com')
    resetRateLimitBuckets()
    resetProcessedVerifications()
    mockSend.mockReset()
    mockSend.mockResolvedValue({ messageId: '42' })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    resetRateLimitBuckets()
    resetProcessedVerifications()
  })

  it('sends the verification email and returns ok with the expiry window', async () => {
    const response = await POST(requestEvent(validBody))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, expiresInHours: 72 })
    expect(mockSend).toHaveBeenCalledTimes(1)
    const call = mockSend.mock.calls[0][0]
    expect(call.toEmail).toBe('ada@example.com')
    expect(call.toName).toBe('Ada Lovelace')
    expect(call.subject).toBe('Confirm your contact request — Advanced Digital Marketing')
    expect(call.htmlPart).toContain('https://advanceddigitalmarketingltda.com/contact/verify/?token=')
    expect(call.textPart).toContain('Ada Lovelace')
  })

  it('never returns the verification token to the browser', async () => {
    const response = await POST(requestEvent(validBody))
    const body = JSON.stringify(await response.json())
    expect(body).not.toContain('token')
  })

  it('rejects invalid names without calling MailJet', async () => {
    const cases = ['', '   ', 'a'.repeat(101), 'bad\nname', 'line\rbreak']
    for (const name of cases) {
      const response = await POST(requestEvent({ ...validBody, name }))
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'invalid_name' })
    }
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('rejects invalid emails without calling MailJet', async () => {
    for (const email of ['', 'not-an-email', 'a@b', 'x@y.c', 'spaces in@email.com', 'a'.repeat(250) + '@example.com']) {
      const response = await POST(requestEvent({ ...validBody, email }))
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'invalid_email' })
    }
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('requires the opt-in consent to be exactly boolean true', async () => {
    for (const consent of [undefined, false, 'yes', 'true', 1, 'on']) {
      const response = await POST(requestEvent({ ...validBody, consent }))
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'consent_required' })
    }
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON', async () => {
    const event = {
      request: new Request('http://localhost/api/contact/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not json',
      }),
    } as Parameters<typeof POST>[0]
    const response = await POST(event)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid_json' })
  })

  it('maps MailJet failures to stable status codes without leaking internals', async () => {
    const cases: [MailjetError, number][] = [
      [new MailjetError('unauthorized', 'x'), 502],
      [new MailjetError('sender_not_authorized', 'x'), 502],
      [new MailjetError('message_rejected', 'x'), 502],
      [new MailjetError('api_error', 'x'), 502],
      [new MailjetError('invalid_response', 'x'), 502],
      [new MailjetError('timeout', 'x'), 503],
      [new MailjetError('missing_credentials', 'x'), 503],
    ]
    for (const [error, status] of cases) {
      mockSend.mockRejectedValueOnce(error)
      const response = await POST(requestEvent(validBody))
      expect(response.status).toBe(status)
      const body = (await response.json()) as Record<string, unknown>
      expect(body).toEqual({ error: error.code })
      expect(JSON.stringify(body)).not.toContain(error.message)
    }
  })

  it('refuses with 503 server_misconfigured when the token secret is missing', async () => {
    vi.stubEnv('CONTACT_FORM_TOKEN_SECRET', '')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const response = await POST(requestEvent(validBody))
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ error: 'server_misconfigured' })
      expect(mockSend).not.toHaveBeenCalled()
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('rejects repeated requests from the same IP with 429 after the window fills', async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await POST(requestEvent(validBody))).status).toBe(200)
    }
    expect(mockSend).toHaveBeenCalledTimes(10)

    const rejected = await POST(requestEvent(validBody))
    expect(rejected.status).toBe(429)
    expect(await rejected.json()).toEqual({ error: 'rate_limited' })
    expect(mockSend).toHaveBeenCalledTimes(10)

    // A different IP is unaffected.
    const otherIp = {
      request: new Request('http://localhost/api/contact/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validBody),
      }),
      getClientAddress: () => '10.0.0.2',
    } as Parameters<typeof POST>[0]
    expect((await POST(otherIp)).status).toBe(200)
  })

  it('fails loudly when no client IP is resolvable', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const event = {
        request: new Request('http://localhost/api/contact/submit', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(validBody),
        }),
        getClientAddress: (): string => {
          throw new Error('adapter provides no client address')
        },
      } as Parameters<typeof POST>[0]

      const response = await POST(event)
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ error: 'client_address_unavailable' })
      expect(mockSend).not.toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('cannot determine client IP for rate limiting'),
      )
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('re-throws unexpected errors (server logs them)', async () => {
    mockSend.mockRejectedValueOnce(new Error('boom'))
    await expect(POST(requestEvent(validBody))).rejects.toThrow('boom')
  })
})
