/**
 * Guards the wait-for-commit-marker contract (scripts/wait-for-netlify-deploy.mjs):
 * the purge must never run at deploy-start and never blindly — the script
 * only returns once the expected commit is live, and it fails loudly on
 * Netlify errors, deploy failures, or timeout (never purging stale content).
 */
import { describe, expect, it, vi } from 'vitest'
import { resolveDeployState, waitForDeploy } from './wait-for-netlify-deploy.mjs'

// Netlify returns deploys newest-first, and resolveDeployState waits for the
// NEWEST deploy of the commit: an older 'ready' deploy does not satisfy a
// newer pending retry of the same commit.
const DEPLOYS = [
  {
    id: 'b',
    commit_ref: 'abc',
    branch: 'main',
    state: 'ready',
    deploy_ssl_url: 'https://abc--adm-ltda.netlify.app',
  },
  { id: 'c', commit_ref: 'other', branch: 'main', state: 'ready' },
  { id: 'a', commit_ref: 'abc', branch: 'main', state: 'building' },
]

const STALE_NEWEST = [
  { id: 'a', commit_ref: 'abc', branch: 'main', state: 'building' },
  {
    id: 'b',
    commit_ref: 'abc',
    branch: 'main',
    state: 'ready',
    deploy_ssl_url: 'https://abc--adm-ltda.netlify.app',
  },
]

const ok = (body) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }))

describe('resolveDeployState', () => {
  it('reports ready for a matching live deploy', () => {
    expect(resolveDeployState(DEPLOYS, 'abc', 'main').status).toBe('ready')
  })

  it('reports not-found when no deploy matches the commit', () => {
    expect(resolveDeployState(DEPLOYS, 'zzz', 'main').status).toBe('not-found')
  })

  it('ignores matching commits on other branches', () => {
    expect(
      resolveDeployState(
        [{ commit_ref: 'abc', branch: 'dev', state: 'ready' }],
        'abc',
        'main',
      ).status,
    ).toBe('not-found')
  })

  it('reports error with the Netlify error message', () => {
    const result = resolveDeployState(
      [
        {
          commit_ref: 'abc',
          branch: 'main',
          state: 'error',
          error_message: 'build failed',
        },
      ],
      'abc',
      'main',
    )
    expect(result.status).toBe('error')
    expect(result.message).toContain('build failed')
  })

  it('reports pending for in-flight states', () => {
    expect(
      resolveDeployState(
        [{ commit_ref: 'abc', branch: 'main', state: 'building' }],
        'abc',
        'main',
      ).status,
    ).toBe('pending')
  })

  it('waits for the newest deploy: an older ready deploy does not satisfy a newer pending retry', () => {
    // Netlify lists newest-first; a rebuild of the same commit means the
    // commit is not live until that newest deploy reaches 'ready'.
    expect(resolveDeployState(STALE_NEWEST, 'abc', 'main').status).toBe('pending')
  })
})

describe('waitForDeploy', () => {
  it('returns when the commit deploy is ready', async () => {
    const fetchImpl = ok(DEPLOYS)
    const result = await waitForDeploy({
      siteId: 's1',
      authToken: 't',
      expectedCommit: 'abc',
      fetchImpl,
    })
    expect(result.status).toBe('ready')
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.netlify.com/api/v1/sites/s1/deploys?per_page=100',
      expect.objectContaining({ headers: { Authorization: 'Bearer t' } }),
    )
  })

  it('fails loudly when the Netlify API errors', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('unauthorized', { status: 401, statusText: 'Unauthorized' }),
    )
    await expect(
      waitForDeploy({ siteId: 's1', authToken: 'bad', expectedCommit: 'abc', fetchImpl }),
    ).rejects.toThrow(/401/)
  })

  it('fails loudly when the deploy enters the error state', async () => {
    const fetchImpl = ok([
      {
        commit_ref: 'abc',
        branch: 'main',
        state: 'error',
        error_message: 'build failed',
      },
    ])
    await expect(
      waitForDeploy({ siteId: 's1', authToken: 't', expectedCommit: 'abc', fetchImpl }),
    ).rejects.toThrow(/build failed/)
  })

  it('times out loudly instead of purging against stale content', async () => {
    const fetchImpl = ok([
      { commit_ref: 'abc', branch: 'main', state: 'building' },
    ])
    let now = 0
    await expect(
      waitForDeploy({
        siteId: 's1',
        authToken: 't',
        expectedCommit: 'abc',
        fetchImpl,
        pollIntervalMs: 1,
        timeoutMs: 50,
        now: () => now,
        sleep: async () => {
          now += 1000
        },
      }),
    ).rejects.toThrow(/timed out/)
  })

  it('fails loudly when a required input is missing', async () => {
    await expect(
      waitForDeploy({ siteId: '', authToken: 't', expectedCommit: 'abc' }),
    ).rejects.toThrow(/NETLIFY_SITE_ID/)
    await expect(
      waitForDeploy({ siteId: 's', authToken: '', expectedCommit: 'abc' }),
    ).rejects.toThrow(/NETLIFY_AUTH_TOKEN/)
    await expect(
      waitForDeploy({ siteId: 's', authToken: 't', expectedCommit: '' }),
    ).rejects.toThrow(/EXPECTED_COMMIT/)
  })
})
