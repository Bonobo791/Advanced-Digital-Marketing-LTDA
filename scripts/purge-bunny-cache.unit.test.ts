/**
 * Guards the Bunny CDN purge contract (scripts/purge-bunny-cache.mjs):
 * a loud dev no-op without creds, a loud hard failure with creds in CI mode,
 * and a non-204 response (or network error) is always a loud failure.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPurgeConfig, main, purgePullZone } from './purge-bunny-cache.mjs'

describe('buildPurgeConfig', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('reads and trims the Bunny credentials', () => {
    vi.stubEnv('BUNNY_API_KEY', '  secret  ')
    vi.stubEnv('BUNNY_PULL_ZONE_ID', ' 42 ')
    expect(buildPurgeConfig()).toEqual({
      apiKey: 'secret',
      pullZoneId: '42',
      requireCreds: false,
    })
  })

  it('treats PURGE_REQUIRE_CREDS=1/true as CI mode', () => {
    vi.stubEnv('PURGE_REQUIRE_CREDS', '1')
    expect(buildPurgeConfig().requireCreds).toBe(true)
    vi.stubEnv('PURGE_REQUIRE_CREDS', 'true')
    expect(buildPurgeConfig().requireCreds).toBe(true)
    vi.stubEnv('PURGE_REQUIRE_CREDS', '0')
    expect(buildPurgeConfig().requireCreds).toBe(false)
  })
})

describe('purgePullZone', () => {
  it('POSTs to the pull-zone purge endpoint with the AccessKey header and accepts 204', async () => {
    const fetchImpl = vi.fn(() => new Response(null, { status: 204 }))
    const status = await purgePullZone({
      apiKey: 'secret',
      pullZoneId: '42',
      fetchImpl,
    })
    expect(status).toBe(204)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.bunny.net/pullzone/42/purgeCache',
      expect.objectContaining({
        method: 'POST',
        headers: { AccessKey: 'secret' },
      }),
    )
  })

  it('fails loudly on a non-204 response', async () => {
    const fetchImpl = vi.fn(
      () => new Response('nope', { status: 401, statusText: 'Unauthorized' }),
    )
    await expect(
      purgePullZone({ apiKey: 'secret', pullZoneId: '42', fetchImpl }),
    ).rejects.toThrow(/401/)
  })

  it('fails loudly when the request throws (network error)', async () => {
    const fetchImpl = vi.fn(() => {
      throw new Error('ECONNRESET')
    })
    await expect(
      purgePullZone({ apiKey: 'secret', pullZoneId: '42', fetchImpl }),
    ).rejects.toThrow(/ECONNRESET/)
  })
})

describe('main', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('is a loud dev no-op without creds', async () => {
    vi.stubEnv('BUNNY_API_KEY', '')
    vi.stubEnv('BUNNY_PULL_ZONE_ID', '')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    try {
      await expect(main()).resolves.toBe(0)
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('skip'))
    } finally {
      logSpy.mockRestore()
    }
  })

  it('refuses to skip without creds in CI mode', async () => {
    vi.stubEnv('BUNNY_API_KEY', '')
    vi.stubEnv('BUNNY_PULL_ZONE_ID', '')
    vi.stubEnv('PURGE_REQUIRE_CREDS', '1')
    await expect(main()).rejects.toThrow(/BUNNY_API_KEY/)
  })

  it('purges when creds are present and logs success', async () => {
    vi.stubEnv('BUNNY_API_KEY', 'secret')
    vi.stubEnv('BUNNY_PULL_ZONE_ID', '42')
    const fetchImpl = vi.fn(() => new Response(null, { status: 204 }))
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    try {
      await expect(main(process.env, fetchImpl)).resolves.toBe(0)
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('purged pull zone 42'),
      )
    } finally {
      logSpy.mockRestore()
    }
  })
})
