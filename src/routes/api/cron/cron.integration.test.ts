import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from './+server'

const requestEvent = (secret?: string) =>
  ({
    request: new Request('http://localhost/api/cron', {
      headers: secret ? { 'x-cron-secret': secret } : undefined,
    }),
  }) as Parameters<typeof GET>[0]

describe('GET /api/cron', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('returns no content for a valid secret', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret')

    const response = await GET(requestEvent('test-secret'))

    expect(response.status).toBe(204)
  })

  it('rejects an invalid secret', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret')

    const response = await GET(requestEvent('wrong-secret'))

    expect(response.status).toBe(401)
    expect(await response.text()).toBe('Missing or invalid x-cron-secret')
  })

  it('reports missing production configuration', async () => {
    vi.stubEnv('CRON_SECRET', '')

    const response = await GET(requestEvent('test-secret'))

    expect(response.status).toBe(503)
    expect(await response.text()).toBe('Cron secret is not configured')
  })
})
