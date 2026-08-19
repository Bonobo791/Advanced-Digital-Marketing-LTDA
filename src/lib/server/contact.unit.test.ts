import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createContactToken } from './contact-token'
import { sendMailjetMessage } from './mailjet'
import {
  contactOwnerEmail,
  contactVerificationUrl,
  processedVerificationCount,
  resetProcessedVerifications,
  submitContactRequest,
  verifyContactRequest,
} from './contact'

vi.mock('./mailjet', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./mailjet')>()
  return { ...actual, sendMailjetMessage: vi.fn() }
})

const mockSend = vi.mocked(sendMailjetMessage)

const SECRET = 'unit-test-secret-that-is-long-enough-32-bytes'
const NOW = 1_700_000_000_000

const validSubmission = { name: 'Ada Lovelace', email: 'ada@example.com', locale: 'en-US' as const }

describe('submitContactRequest', () => {
  beforeEach(() => {
    vi.stubEnv('CONTACT_FORM_TOKEN_SECRET', SECRET)
    vi.stubEnv('MAILJET_SENDER_EMAIL', 'sender@advanceddigitalmarketingltda.com')
    vi.stubEnv('CONTACT_FORM_OWNER_EMAIL', 'owner@advanceddigitalmarketingltda.com')
    vi.stubEnv('PUBLIC_SITE_URL', 'https://example.com')
    mockSend.mockReset()
    mockSend.mockResolvedValue({ messageId: '42' })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    resetProcessedVerifications()
  })

  it('sends a localized verification email whose link verifies', async () => {
    const result = await submitContactRequest(validSubmission)
    expect(result.expiresInHours).toBe(72)

    expect(mockSend).toHaveBeenCalledTimes(1)
    const call = mockSend.mock.calls[0][0]
    expect(call.toEmail).toBe('ada@example.com')
    expect(call.toName).toBe('Ada Lovelace')
    expect(call.subject).toBe('Confirm your contact request — Advanced Digital Marketing')

    // The link points at the en verify route on the public origin and carries
    // a token; extract it and confirm it verifies for this submission.
    const match = call.htmlPart!.match(/https:\/\/example\.com\/contact\/verify\/\?token=([^"<&]+)/)
    expect(match).not.toBeNull()
    const { verifyContactToken } = await import('./contact-token')
    const verified = verifyContactToken(match![1], NOW + 60_000)
    expect(verified.status).toBe('verified')
    if (verified.status === 'verified') {
      expect(verified.payload.email).toBe('ada@example.com')
      expect(verified.payload.name).toBe('Ada Lovelace')
      expect(verified.payload.locale).toBe('en-US')
    }
  })

  it('HTML-escapes the visitor name in the email HTML (anti-phishing)', async () => {
    await submitContactRequest({ ...validSubmission, name: 'Ada <script>alert(1)</script>' })
    const call = mockSend.mock.calls[0][0]
    expect(call.htmlPart).toContain('Ada &lt;script&gt;alert(1)&lt;/script&gt;')
    expect(call.htmlPart).not.toContain('<script>')
  })

  it('uses the pt-BR verify route for Portuguese submissions', async () => {
    await submitContactRequest({ ...validSubmission, locale: 'pt-BR' })
    const call = mockSend.mock.calls[0][0]
    expect(call.htmlPart).toContain('https://example.com/pt-br/contato/verificar/?token=')
    expect(call.subject).toBe('Confirme sua solicitação de contato — Advanced Digital Marketing')
  })
})

describe('verifyContactRequest', () => {
  beforeEach(() => {
    vi.stubEnv('CONTACT_FORM_TOKEN_SECRET', SECRET)
    vi.stubEnv('MAILJET_SENDER_EMAIL', 'sender@advanceddigitalmarketingltda.com')
    vi.stubEnv('CONTACT_FORM_OWNER_EMAIL', 'owner@advanceddigitalmarketingltda.com')
    vi.stubEnv('PUBLIC_SITE_URL', 'https://example.com')
    mockSend.mockReset()
    mockSend.mockResolvedValue({ messageId: '42' })
    resetProcessedVerifications()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    resetProcessedVerifications()
  })

  it('returns verified and emails the owner the contact + consent timestamp', async () => {
    const { token } = createContactToken(validSubmission, NOW, SECRET)
    const result = await verifyContactRequest(token, NOW + 60_000)
    expect(result).toEqual({ status: 'verified', name: 'Ada Lovelace', email: 'ada@example.com' })

    expect(mockSend).toHaveBeenCalledTimes(1)
    const call = mockSend.mock.calls[0][0]
    expect(call.toEmail).toBe('owner@advanceddigitalmarketingltda.com')
    expect(call.subject).toBe('New verified contact: Ada Lovelace <ada@example.com>')
    expect(call.textPart).toContain('ada@example.com')
    expect(call.textPart).toContain(new Date(NOW).toISOString())
  })

  it('does not email the owner twice for the same token (replay/double click)', async () => {
    const { token } = createContactToken(validSubmission, NOW, SECRET)
    await verifyContactRequest(token, NOW + 60_000)
    await verifyContactRequest(token, NOW + 120_000)
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('returns invalid for a tampered token and sends nothing', async () => {
    const { token } = createContactToken(validSubmission, NOW, SECRET)
    const tampered = (token[0] === 'A' ? 'B' : 'A') + token.slice(1)
    expect(await verifyContactRequest(tampered, NOW + 60_000)).toEqual({ status: 'invalid' })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('returns expired for an old token and sends nothing', async () => {
    const { token } = createContactToken(validSubmission, NOW, SECRET)
    const later = NOW + 73 * 60 * 60 * 1000
    expect(await verifyContactRequest(token, later)).toEqual({ status: 'expired' })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('reports notification_failed when the owner notification fails (loud log + honest page state)', async () => {
    // AGENTS.md: "show to the user". A silent 'verified' would claim the
    // request reached the owner when it did not — the visitor must see that
    // the notification failed and that re-opening the link retries it.
    const { MailjetError } = await import('./mailjet')
    mockSend.mockRejectedValueOnce(new MailjetError('api_error', 'MailJet down'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { token } = createContactToken(validSubmission, NOW, SECRET)
      const result = await verifyContactRequest(token, NOW + 60_000)
      expect(result).toEqual({
        status: 'notification_failed',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
      })
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('owner notification failed'))
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('retries the owner notification on a later click after a transient failure', async () => {
    // markProcessed must not permanently suppress the notification: when the
    // first send fails, the token is unmarked so the next verification click
    // retries instead of losing the verified lead on this instance.
    const { MailjetError } = await import('./mailjet')
    mockSend.mockRejectedValueOnce(new MailjetError('api_error', 'MailJet down'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { token } = createContactToken(validSubmission, NOW, SECRET)
      const first = await verifyContactRequest(token, NOW + 60_000)
      expect(first.status).toBe('notification_failed')
      expect(mockSend).toHaveBeenCalledTimes(1)

      const second = await verifyContactRequest(token, NOW + 120_000)
      expect(second.status).toBe('verified')
      expect(mockSend).toHaveBeenCalledTimes(2)
      expect(errorSpy).toHaveBeenCalledTimes(1)
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('reports unconfigured (not invalid) when the token secret is missing', async () => {
    vi.stubEnv('CONTACT_FORM_TOKEN_SECRET', '')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { token } = createContactToken(validSubmission, NOW, SECRET)
      expect(await verifyContactRequest(token, NOW + 60_000)).toEqual({ status: 'unconfigured' })
      expect(mockSend).not.toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('CONTACT_FORM_TOKEN_SECRET'))
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('carries the option subject through to the owner notification and sets Reply-To', async () => {
    const { token } = createContactToken({ ...validSubmission, subject: 'Account audit request' }, NOW, SECRET)
    const result = await verifyContactRequest(token, NOW + 60_000)
    expect(result.status).toBe('verified')

    expect(mockSend).toHaveBeenCalledTimes(1)
    const call = mockSend.mock.calls[0][0]
    expect(call.textPart).toContain('Subject: Account audit request')
    // The owner's Reply must reach the verified lead, not the site's sender.
    expect(call.replyToEmail).toBe('ada@example.com')
  })
})

describe('contact helpers', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('builds verification URLs on the public origin with the token encoded', () => {
    vi.stubEnv('PUBLIC_SITE_URL', 'https://example.com')
    expect(contactVerificationUrl('a b+c', 'en-US')).toBe(
      'https://example.com/contact/verify/?token=a%20b%2Bc',
    )
  })

  it('falls back to the site contact address for the owner inbox with a loud log', () => {
    vi.stubEnv('CONTACT_FORM_OWNER_EMAIL', '')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(contactOwnerEmail()).toBe('contact@AdvancedDigitalMarketingLTDA.com')
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('CONTACT_FORM_OWNER_EMAIL'))
    } finally {
      errorSpy.mockRestore()
    }
  })
})

describe('processed-verification test hooks', () => {
  beforeEach(() => resetProcessedVerifications())
  afterEach(() => resetProcessedVerifications())

  it('exposes test hooks (count/reset)', () => {
    expect(processedVerificationCount()).toBe(0)
    resetProcessedVerifications()
    expect(processedVerificationCount()).toBe(0)
  })
})
