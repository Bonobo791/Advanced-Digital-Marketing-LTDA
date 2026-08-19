import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MAILJET_SEND_ENDPOINT,
  MailjetError,
  sendMailjetMessage,
} from './mailjet'

const API_KEY = 'mj-api-key'
const API_SECRET = 'mj-api-secret'
const SENDER = 'sender@advanceddigitalmarketingltda.com'

const validInput = {
  toEmail: 'ada@example.com',
  toName: 'Ada Lovelace',
  subject: 'Confirm your contact request',
  textPart: 'Please click the link.',
  htmlPart: '<p>Please click the link.</p>',
}

function okResponse() {
  return new Response(
    JSON.stringify({
      Messages: [
        {
          Status: 'success',
          To: [{ Email: 'ada@example.com', MessageID: 1234567890 }],
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

async function captureRequest(): Promise<{ url: string; init: RequestInit }> {
  let captured: { url: string; init: RequestInit } | undefined
  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    captured = { url: String(url), init: init ?? {} }
    return okResponse()
  })
  vi.stubGlobal('fetch', fetchMock)
  await sendMailjetMessage(validInput)
  return captured!
}

describe('sendMailjetMessage', () => {
  beforeEach(() => {
    vi.stubEnv('MAILJET_API_KEY', API_KEY)
    vi.stubEnv('MAILJET_API_SECRET', API_SECRET)
    vi.stubEnv('MAILJET_SENDER_EMAIL', SENDER)
    vi.stubEnv('MAILJET_SENDER_NAME', 'ADM')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('POSTs a v3.1 message with Basic auth and the validated sender', async () => {
    const captured = await captureRequest()
    expect(captured.url).toBe(MAILJET_SEND_ENDPOINT)
    const headers = captured.init.headers as Record<string, string>
    expect(headers['Authorization']).toBe(
      `Basic ${Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64')}`,
    )
    const body = JSON.parse(String(captured.init.body)) as {
      Messages: Array<{ From: { Email: string; Name: string }; To: Array<{ Email: string }>; Subject: string; TextPart: string; HTMLPart: string }>
    }
    expect(body.Messages).toHaveLength(1)
    const message = body.Messages[0]
    expect(message.From).toEqual({ Email: SENDER, Name: 'ADM' })
    expect(message.To).toEqual([{ Email: 'ada@example.com', Name: 'Ada Lovelace' }])
    expect(message.Subject).toBe('Confirm your contact request')
    expect(message.TextPart).toContain('Please click the link.')
    // SandboxMode is a ROOT property, never per-message.
    expect('SandboxMode' in body).toBe(false)
    expect('SandboxMode' in message).toBe(false)
  })

  it('enables root-level SandboxMode when MAILJET_SANDBOX_MODE=true (no delivery)', async () => {
    vi.stubEnv('MAILJET_SANDBOX_MODE', 'true')
    let captured: { init: RequestInit } | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        captured = { init: init ?? {} }
        return okResponse()
      }),
    )
    await sendMailjetMessage(validInput)
    const body = JSON.parse(String(captured!.init.body)) as Record<string, unknown>
    expect(body.SandboxMode).toBe(true)
  })

  it('returns the message id on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okResponse()))
    const result = await sendMailjetMessage(validInput)
    expect(result).toEqual({ messageId: '1234567890' })
  })

  it('throws missing_credentials without calling MailJet when either credential is missing', async () => {
    vi.stubEnv('MAILJET_API_SECRET', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendMailjetMessage(validInput)).rejects.toMatchObject({
      name: 'MailjetError',
      code: 'missing_credentials',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('classifies HTTP 401 as unauthorized', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ErrorCode: 'mj-0001', ErrorMessage: 'suspended' }), { status: 401 })),
    )
    await expect(sendMailjetMessage(validInput)).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('classifies HTTP 403 send-0008 as sender_not_authorized (unvalidated sender)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ ErrorCode: 'send-0008', ErrorMessage: 'sender not authorized' }), { status: 403 }),
      ),
    )
    await expect(sendMailjetMessage(validInput)).rejects.toMatchObject({ code: 'sender_not_authorized' })
  })

  it('classifies other 4xx responses as api_error and logs the body', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({ ErrorCode: 'mj-0002', ErrorMessage: 'malformed' }), { status: 400 })),
      )
      await expect(sendMailjetMessage(validInput)).rejects.toMatchObject({ code: 'api_error' })
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('malformed'))
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('treats HTTP 200 with per-message Status "error" as message_rejected', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                Messages: [{ Status: 'error', Errors: [{ ErrorCode: 'send-0003', ErrorMessage: 'no content' }] }],
              }),
              { status: 200 },
            ),
        ),
      )
      await expect(sendMailjetMessage(validInput)).rejects.toMatchObject({ code: 'message_rejected' })
      // Only the classification fields are logged — the free-text ErrorMessage
      // (which can echo the recipient address) is dropped.
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('send-0003'))
      expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('no content'))
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('maps network timeouts to the timeout code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw Object.assign(new Error('timed out'), { name: 'TimeoutError' })
      }),
    )
    await expect(sendMailjetMessage(validInput)).rejects.toMatchObject({ code: 'timeout' })
  })

  it('throws invalid_response for malformed JSON bodies', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not json', { status: 200 })))
    await expect(sendMailjetMessage(validInput)).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('omits the HTMLPart when none is provided (owner notification path)', async () => {
    let captured: { init: RequestInit } | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        captured = { init: init ?? {} }
        return okResponse()
      }),
    )
    await sendMailjetMessage({ ...validInput, htmlPart: undefined })
    const body = JSON.parse(String(captured!.init.body)) as { Messages: Array<Record<string, unknown>> }
    expect('HTMLPart' in body.Messages[0]).toBe(false)
  })

  it('falls back to the site contact sender with a loud log when MAILJET_SENDER_EMAIL is unset', async () => {
    vi.stubEnv('MAILJET_SENDER_EMAIL', '')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const captured = await captureRequest()
      const body = JSON.parse(String(captured.init.body)) as { Messages: Array<{ From: { Email: string } }> }
      expect(body.Messages[0].From.Email).toBe('contact@AdvancedDigitalMarketingLTDA.com')
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('MAILJET_SENDER_EMAIL'))
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('sets Reply-To as a single contact object when a replyToEmail is provided (owner notification path)', async () => {
    // MailJet Send API v3.1 expects ReplyTo to be a single contact OBJECT
    // (unlike the array-valued To/Cc/Bcc); an array makes the API reject the
    // message, so the exact serialized shape is pinned here.
    let captured: { init: RequestInit } | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        captured = { init: init ?? {} }
        return okResponse()
      }),
    )
    await sendMailjetMessage({ ...validInput, replyToEmail: 'lead@example.com' })
    const body = JSON.parse(String(captured!.init.body)) as { Messages: Array<Record<string, unknown>> }
    expect(body.Messages[0].ReplyTo).toEqual({ Email: 'lead@example.com' })
    expect(Array.isArray(body.Messages[0].ReplyTo)).toBe(false)
  })

  it('omits Reply-To when none is provided (verification email path)', async () => {
    const captured = await captureRequest()
    const body = JSON.parse(String(captured.init.body)) as { Messages: Array<Record<string, unknown>> }
    expect('ReplyTo' in body.Messages[0]).toBe(false)
  })

  it('redacts recipient addresses from logged error bodies (privacy)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                ErrorCode: 'send-0003',
                ErrorMessage: 'invalid recipient ada@example.com',
              }),
              { status: 400 },
            ),
        ),
      )
      await expect(sendMailjetMessage(validInput)).rejects.toMatchObject({ code: 'api_error' })
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('send-0003'))
      // The visitor's address must never land in server logs.
      expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('ada@example.com'))
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[email redacted]'))
    } finally {
      errorSpy.mockRestore()
    }
  })

})
