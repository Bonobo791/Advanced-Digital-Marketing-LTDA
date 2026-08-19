/**
 * Guards the public-origin resolution contract (src/lib/server/site-url.ts):
 * only a real public HTTPS origin is ever used for verification links and
 * Mercado Pago back_urls; loopback/local/private values fall back to the
 * canonical SITE_ORIGIN with a loud server log — including fully qualified
 * hostnames with a terminal dot, which URL parsing preserves.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { publicSiteOrigin } from './site-url'
import { SITE_ORIGIN } from '$lib/locale'

describe('publicSiteOrigin', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('uses a valid public HTTPS origin', () => {
    vi.stubEnv('PUBLIC_SITE_URL', 'https://www.example.com')
    expect(publicSiteOrigin()).toBe('https://www.example.com')
  })

  it('falls back loudly for loopback, local and private hosts', () => {
    const cases = [
      'http://localhost',
      'https://localhost',
      'https://localhost:5173',
      'https://127.0.0.1',
      'https://0.0.0.0',
      'https://[::1]',
      'https://foo.localhost',
      'https://foo.local',
      // Single-label values parse fine but are not real public FQDNs — usually
      // a typo (https://staging) that would emit unusable links.
      'https://staging',
      'https://dev',
      'https://192.168.1.10',
      'https://10.0.0.2',
      'ftp://example.com',
      'not a url',
    ]
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      for (const value of cases) {
        vi.stubEnv('PUBLIC_SITE_URL', value)
        expect(publicSiteOrigin()).toBe(SITE_ORIGIN)
      }
      expect(errorSpy).toHaveBeenCalled()
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('normalizes a terminal dot before hostname validation (localhost. / foo.local.)', () => {
    // A fully qualified hostname preserves the terminal dot in the parsed
    // URL; without normalization a loopback origin would slip through and
    // produce unusable verification links.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      vi.stubEnv('PUBLIC_SITE_URL', 'https://localhost.')
      expect(publicSiteOrigin()).toBe(SITE_ORIGIN)
      vi.stubEnv('PUBLIC_SITE_URL', 'https://foo.local.')
      expect(publicSiteOrigin()).toBe(SITE_ORIGIN)
      expect(errorSpy).toHaveBeenCalled()
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('accepts a public hostname that happens to end in .local only when it is a real public suffix', () => {
    // 'local.' as a terminal dot is the trap; a real public domain with a
    // trailing dot is still public after normalization.
    vi.stubEnv('PUBLIC_SITE_URL', 'https://example.com.')
    expect(publicSiteOrigin()).toBe('https://example.com')
  })

  it('falls back loudly when PUBLIC_SITE_URL is unset', () => {
    vi.stubEnv('PUBLIC_SITE_URL', '')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(publicSiteOrigin()).toBe(SITE_ORIGIN)
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('PUBLIC_SITE_URL'))
    } finally {
      errorSpy.mockRestore()
    }
  })
})
