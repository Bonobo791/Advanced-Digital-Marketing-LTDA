import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CONTACT_TOKEN_TTL_SECONDS,
  CONTACT_TOKEN_VERSION,
  createContactToken,
  readContactTokenSecret,
  verifyContactToken,
} from './contact-token'

const SECRET = 'unit-test-secret-that-is-long-enough-32-bytes'
const NOW = 1_700_000_000_000 // fixed "now" in ms
const NOW_SECONDS = Math.floor(NOW / 1000)

describe('createContactToken', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('signs a token that verifies with the same secret', () => {
    const { token, expiresAt } = createContactToken(
      { email: 'ada@example.com', name: 'Ada Lovelace', locale: 'en-US' },
      NOW,
      SECRET,
    )
    expect(expiresAt).toBe((NOW_SECONDS + CONTACT_TOKEN_TTL_SECONDS) * 1000)
    expect(token).toContain('.')

    vi.stubEnv('CONTACT_FORM_TOKEN_SECRET', SECRET)
    const result = verifyContactToken(token, NOW)
    expect(result).toEqual({
      status: 'verified',
      payload: {
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        locale: 'en-US',
        issuedAt: NOW_SECONDS,
        expiresAt: NOW_SECONDS + CONTACT_TOKEN_TTL_SECONDS,
      },
    })
  })

  it('is deterministic per payload (same inputs, same token)', () => {
    const input = { email: 'ada@example.com', name: 'Ada', locale: 'pt-BR' } as const
    const a = createContactToken(input, NOW, SECRET)
    const b = createContactToken(input, NOW, SECRET)
    expect(a.token).toBe(b.token)
    expect(a.expiresAt).toBe(b.expiresAt)
  })

  it('fails loudly when the token secret is not configured', () => {
    vi.stubEnv('CONTACT_FORM_TOKEN_SECRET', '')
    expect(() => createContactToken({ email: 'a@example.com', name: 'A', locale: 'en-US' })).toThrowError(
      expect.objectContaining({ code: 'missing_secret' }),
    )
  })
})

describe('verifyContactToken', () => {
  afterEach(() => vi.unstubAllEnvs())

  function signed(overrides: Partial<Record<string, unknown>> = {}) {
    const input = { email: 'ada@example.com', name: 'Ada', locale: 'en-US', ...overrides }
    return createContactToken(
      { email: input.email as string, name: input.name as string, locale: input.locale as 'en-US' | 'pt-BR' },
      NOW,
      SECRET,
    ).token
  }

  it('rejects a token signed with a different secret', () => {
    const token = signed()
    vi.stubEnv('CONTACT_FORM_TOKEN_SECRET', 'another-secret')
    expect(verifyContactToken(token, NOW).status).toBe('invalid')
  })

  it('rejects a tampered payload (signature no longer matches)', () => {
    const token = signed()
    // Flip one character inside the encoded payload half.
    const dot = token.indexOf('.')
    const tampered =
      (token[0] === 'A' ? 'B' : 'A') + token.slice(1, dot) + token.slice(dot)
    vi.stubEnv('CONTACT_FORM_TOKEN_SECRET', SECRET)
    expect(verifyContactToken(tampered, NOW).status).toBe('invalid')
  })

  it('rejects a tampered signature', () => {
    const token = signed()
    const dot = token.indexOf('.')
    const tampered = token.slice(0, dot + 1) + (token.endsWith('0') ? '1' : '0') + token.slice(dot + 2)
    vi.stubEnv('CONTACT_FORM_TOKEN_SECRET', SECRET)
    expect(verifyContactToken(tampered, NOW).status).toBe('invalid')
  })

  it('rejects a valid signature with junk appended (non-canonical hex)', () => {
    // Buffer.from(value, 'hex') silently stops at the first invalid character,
    // so a canonical check is required: a valid signature followed by junk must
    // not compare equal.
    const token = signed()
    const dot = token.indexOf('.')
    const nonCanonical = token.slice(0, dot + 1) + token.slice(dot + 1) + 'zz'
    vi.stubEnv('CONTACT_FORM_TOKEN_SECRET', SECRET)
    expect(verifyContactToken(nonCanonical, NOW).status).toBe('invalid')
  })

  it('reports expired tokens after the TTL', () => {
    const token = signed()
    vi.stubEnv('CONTACT_FORM_TOKEN_SECRET', SECRET)
    const result = verifyContactToken(token, NOW + CONTACT_TOKEN_TTL_SECONDS * 1000 + 1)
    expect(result).toEqual({ status: 'expired' })
    // Still valid one second before expiry.
    expect(verifyContactToken(token, NOW + CONTACT_TOKEN_TTL_SECONDS * 1000 - 1).status).toBe('verified')
  })

  it('rejects malformed tokens without throwing', () => {
    vi.stubEnv('CONTACT_FORM_TOKEN_SECRET', SECRET)
    for (const token of ['', 'no-dot', 'a.', '.b', 'a.b.c', '!!!.###', 'a'.repeat(200)]) {
      expect(verifyContactToken(token, NOW).status).toBe('invalid')
    }
  })

  it('rejects tokens carrying an unknown version', () => {
    // Re-encode with version 2 (same secret, valid signature, unknown shape).
    const encoded = Buffer.from(
      JSON.stringify([CONTACT_TOKEN_VERSION + 1, 'a@example.com', 'A', 'en-US', NOW_SECONDS, NOW_SECONDS + 60]),
    ).toString('base64url')
    const forged = `${encoded}.${createHmac('sha256', SECRET).update(encoded).digest('hex')}`
    vi.stubEnv('CONTACT_FORM_TOKEN_SECRET', SECRET)
    expect(verifyContactToken(forged, NOW).status).toBe('invalid')
  })

  it('reports unconfigured (not invalid) when verifying while the secret is missing', () => {
    // A missing secret is a server misconfiguration, not a bad link: the
    // verify page must show a truthful retry-later state, never claim the
    // link was copied incorrectly.
    vi.stubEnv('CONTACT_FORM_TOKEN_SECRET', '')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(verifyContactToken('x.y', NOW).status).toBe('unconfigured')
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('CONTACT_FORM_TOKEN_SECRET'))
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('reads the secret from the environment (production path)', () => {
    vi.stubEnv('CONTACT_FORM_TOKEN_SECRET', SECRET)
    expect(readContactTokenSecret()).toBe(SECRET)
    vi.stubEnv('CONTACT_FORM_TOKEN_SECRET', '   ')
    expect(readContactTokenSecret()).toBeUndefined()
  })

  it('round-trips an optional subject in v2 tokens', () => {
    vi.stubEnv('CONTACT_FORM_TOKEN_SECRET', SECRET)
    const { token } = createContactToken(
      { email: 'ada@example.com', name: 'Ada', locale: 'en-US', subject: 'Account audit request' },
      NOW,
      SECRET,
    )
    const result = verifyContactToken(token, NOW)
    expect(result.status).toBe('verified')
    if (result.status === 'verified') {
      expect(result.payload.subject).toBe('Account audit request')
    }
  })

  it('still verifies legacy v1 tokens (no subject) for their full lifetime', () => {
    // v1 was the six-field format shipped before the subject field; in-flight
    // verification emails must keep working until they expire.
    const encoded = Buffer.from(
      JSON.stringify([1, 'ada@example.com', 'Ada Lovelace', 'en-US', NOW_SECONDS, NOW_SECONDS + 60]),
    ).toString('base64url')
    const legacyToken = `${encoded}.${createHmac('sha256', SECRET).update(encoded).digest('hex')}`
    vi.stubEnv('CONTACT_FORM_TOKEN_SECRET', SECRET)
    const result = verifyContactToken(legacyToken, NOW)
    expect(result.status).toBe('verified')
    if (result.status === 'verified') {
      expect(result.payload.subject).toBeUndefined()
    }
  })

  it('rejects a v2 token missing the seventh subject field', () => {
    const encoded = Buffer.from(
      JSON.stringify([2, 'ada@example.com', 'Ada Lovelace', 'en-US', NOW_SECONDS, NOW_SECONDS + 60]),
    ).toString('base64url')
    const bad = `${encoded}.${createHmac('sha256', SECRET).update(encoded).digest('hex')}`
    vi.stubEnv('CONTACT_FORM_TOKEN_SECRET', SECRET)
    expect(verifyContactToken(bad, NOW).status).toBe('invalid')
  })

  it('rejects a subject with control characters', () => {
    const encoded = Buffer.from(
      JSON.stringify([2, 'ada@example.com', 'Ada Lovelace', 'en-US', NOW_SECONDS, NOW_SECONDS + 60, 'bad\nsubject']),
    ).toString('base64url')
    const bad = `${encoded}.${createHmac('sha256', SECRET).update(encoded).digest('hex')}`
    vi.stubEnv('CONTACT_FORM_TOKEN_SECRET', SECRET)
    expect(verifyContactToken(bad, NOW).status).toBe('invalid')
  })
})
