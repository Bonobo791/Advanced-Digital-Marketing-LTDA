/**
 * Guards the wait-for-commit-marker contract (scripts/wait-for-coolify-deploy.mjs):
 * the purge must never run at deploy-start and never blindly — the script only
 * returns once the deployment for the expected commit is 'finished', it fails
 * loudly on Coolify API errors, failed/cancelled deployments, or timeout
 * (never purging stale content), and it enforces the deadline even while the
 * Coolify API request is still pending.
 */
import { describe, expect, it, vi } from 'vitest'
import { resolveCoolifyDeployment, waitForCoolifyDeploy } from './wait-for-coolify-deploy.mjs'

const DEPLOYMENTS = [
  { deployment_uuid: 'abc', commit: 'sha1', status: 'queued', updated_at: '2026-08-19T10:00:02Z' },
  {
    deployment_uuid: 'def',
    commit: 'sha1',
    status: 'finished',
    updated_at: '2026-08-19T10:00:03Z',
  },
  { deployment_uuid: 'ghi', commit: 'other', status: 'finished', updated_at: '2026-08-19T09:00:00Z' },
]

const ok = (body: unknown) => vi.fn(() => new Response(JSON.stringify(body), { status: 200 }))

const BASE_ARGS = {
  apiUrl: 'https://coolify.example.com',
  apiToken: 't',
  applicationUuid: 'app-1',
  expectedCommit: 'sha1',
}

describe('resolveCoolifyDeployment', () => {
  it('reports ready for the newest finished deployment of the commit', () => {
    expect(resolveCoolifyDeployment(DEPLOYMENTS, 'sha1').status).toBe('ready')
  })

  it('prefers the newest deployment when the commit has several', () => {
    const result = resolveCoolifyDeployment(
      [
        { deployment_uuid: 'old', commit: 'sha1', status: 'failed', updated_at: '2026-08-19T09:00:00Z' },
        { deployment_uuid: 'new', commit: 'sha1', status: 'finished', updated_at: '2026-08-19T10:00:00Z' },
      ],
      'sha1',
    )
    expect(result).toEqual({ status: 'ready', deploymentUuid: 'new' })
  })

  it('reports not-found when no deployment matches the commit', () => {
    expect(resolveCoolifyDeployment(DEPLOYMENTS, 'zzz').status).toBe('not-found')
  })

  it('reports error for failed and cancelled deployments', () => {
    for (const status of ['failed', 'cancelled-by-user']) {
      const result = resolveCoolifyDeployment(
        [{ deployment_uuid: 'x', commit: 'sha1', status }],
        'sha1',
      )
      expect(result.status).toBe('error')
      expect(result.message).toContain(status)
    }
  })

  it('reports pending for in-flight states', () => {
    for (const status of ['queued', 'in_progress']) {
      expect(
        resolveCoolifyDeployment([{ deployment_uuid: 'x', commit: 'sha1', status }], 'sha1').status,
      ).toBe('pending')
    }
  })

  it('filters by application uuid/name when the fields are present', () => {
    const deployments = [
      { deployment_uuid: 'a', commit: 'sha1', status: 'finished', application_uuid: 'app-1', application_name: 'adm' },
      { deployment_uuid: 'b', commit: 'sha1', status: 'finished', application_uuid: 'app-2', application_name: 'other' },
    ]
    expect(
      resolveCoolifyDeployment(deployments, 'sha1', { applicationUuid: 'app-2' }).deploymentUuid,
    ).toBe('b')
    expect(
      resolveCoolifyDeployment(deployments, 'sha1', { applicationName: 'adm' }).deploymentUuid,
    ).toBe('a')
  })
})

describe('waitForCoolifyDeploy', () => {
  it('returns when the commit deployment is finished', async () => {
    const fetchImpl = ok(DEPLOYMENTS)
    const result = await waitForCoolifyDeploy({
      ...BASE_ARGS,
      test: { fetchImpl },
    })
    expect(result.status).toBe('ready')
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://coolify.example.com/api/v1/deployments/applications/app-1',
      expect.objectContaining({ headers: { Authorization: 'Bearer t' } }),
    )
  })

  it('fails loudly when the Coolify API errors', async () => {
    const fetchImpl = vi.fn(
      () => new Response('unauthorized', { status: 401, statusText: 'Unauthorized' }),
    )
    await expect(
      waitForCoolifyDeploy({ ...BASE_ARGS, apiToken: 'bad', test: { fetchImpl } }),
    ).rejects.toThrow(/401/)
  })

  it('fails loudly when the deployment fails or is cancelled', async () => {
    for (const status of ['failed', 'cancelled-by-user']) {
      const fetchImpl = ok([{ deployment_uuid: 'x', commit: 'sha1', status }])
      await expect(
        waitForCoolifyDeploy({ ...BASE_ARGS, test: { fetchImpl } }),
      ).rejects.toThrow(status)
    }
  })

  it('times out loudly instead of purging against stale content', async () => {
    const fetchImpl = ok([{ deployment_uuid: 'x', commit: 'sha1', status: 'in_progress' }])
    let now = 0
    await expect(
      waitForCoolifyDeploy({
        ...BASE_ARGS,
        timing: { pollIntervalMs: 1, timeoutMs: 50 },
        test: {
          fetchImpl,
          now: () => now,
          sleep: () => {
            now += 1000
          },
        },
      }),
    ).rejects.toThrow(/timed out/)
  })

  it('enforces the deadline while the Coolify API request is still pending', async () => {
    // A fetch that never resolves must not keep the script alive past the
    // documented budget: the request runs under an abort signal tied to the
    // remaining deadline, so the wait rejects with the timeout error instead
    // of hanging until the 30-minute GitHub Actions job timeout.
    const pendingFetch = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          // Real fetch rejects on abort; the mock must mirror that so the
          // abort signal's deadline enforcement is what the test exercises.
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )
    await expect(
      waitForCoolifyDeploy({
        ...BASE_ARGS,
        timing: { timeoutMs: 50 },
        test: { fetchImpl: pendingFetch },
      }),
    ).rejects.toThrow(/timed out/)
  })

  it('triggers a deploy from CI once when the webhook never starts one, then waits for it', async () => {
    // Self-healing fallback (docs/coolify-deployment.md): after the grace
    // window with NO deployment for the commit (the webhook silently failed),
    // POST /api/v1/deploy exactly once; polling continues until the triggered
    // deployment finishes.
    const states = [
      [], // webhook missed the push: no deployment record yet
      [], // still nothing after one more poll
      [], // grace window elapsed — the trigger fires on this poll
      [{ deployment_uuid: 'x', commit: 'sha1', status: 'queued' }],
      [{ deployment_uuid: 'x', commit: 'sha1', status: 'in_progress' }],
      [{ deployment_uuid: 'x', commit: 'sha1', status: 'finished' }],
    ]
    let calls = 0
    const fetchImpl = vi.fn(() => {
      const body = states[Math.min(calls, states.length - 1)]
      calls += 1
      return new Response(JSON.stringify(body), { status: 200 })
    })
    const deployImpl = vi.fn(() => new Response(null, { status: 200 }))
    let now = 0
    const result = await waitForCoolifyDeploy({
      ...BASE_ARGS,
      timing: { pollIntervalMs: 1, timeoutMs: 60_000, triggerAfterMs: 2 },
      test: {
        fetchImpl,
        deployImpl,
        now: () => now,
        sleep: () => {
          now += 1
        },
      },
    })
    expect(result.status).toBe('ready')
    expect(deployImpl).toHaveBeenCalledTimes(1)
    expect(deployImpl).toHaveBeenCalledWith(
      'https://coolify.example.com',
      't',
      'app-1',
      expect.any(AbortSignal),
    )
  })

  it('enforces the deployment deadline when the fallback deploy trigger hangs', async () => {
    // The self-healing POST runs under the same deadline-bound abort signal as
    // the polls: a deployImpl that never settles must abort and fail loudly
    // instead of outliving the documented budget.
    const fetchImpl = vi.fn(() => new Response(JSON.stringify([]), { status: 200 }))
    const deployImpl = vi.fn(
      (_base: string, _token: string, _uuid: string, signal?: AbortSignal) =>
        new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )
    let now = 0
    await expect(
      waitForCoolifyDeploy({
        ...BASE_ARGS,
        timing: { pollIntervalMs: 1, timeoutMs: 50, triggerAfterMs: 2 },
        test: {
          fetchImpl,
          deployImpl,
          now: () => now,
          sleep: () => {
            now += 1
          },
        },
      }),
    ).rejects.toThrow(/deploy trigger did not complete within the deployment deadline/)
  })

  it('never double-triggers a deploy once one has been sent', async () => {
    // The commit stays absent the whole wait: the trigger fires on the first
    // poll past the grace window and must never fire again before the timeout.
    const fetchImpl = vi.fn(() => new Response(JSON.stringify([]), { status: 200 }))
    const deployImpl = vi.fn(() => new Response(null, { status: 200 }))
    let now = 0
    await expect(
      waitForCoolifyDeploy({
        ...BASE_ARGS,
        timing: { pollIntervalMs: 1, timeoutMs: 50, triggerAfterMs: 2 },
        test: {
          fetchImpl,
          deployImpl,
          now: () => now,
          sleep: () => {
            now += 10
          },
        },
      }),
    ).rejects.toThrow(/timed out/)
    expect(deployImpl).toHaveBeenCalledTimes(1)
  })

  it('fails loudly when a required input is missing', async () => {
    await expect(
      waitForCoolifyDeploy({ ...BASE_ARGS, apiUrl: '' }),
    ).rejects.toThrow(/COOLIFY_API_URL/)
    await expect(
      waitForCoolifyDeploy({ ...BASE_ARGS, apiToken: '' }),
    ).rejects.toThrow(/COOLIFY_API_TOKEN/)
    await expect(
      waitForCoolifyDeploy({ ...BASE_ARGS, expectedCommit: '' }),
    ).rejects.toThrow(/EXPECTED_COMMIT/)
    await expect(
      waitForCoolifyDeploy({ ...BASE_ARGS, applicationUuid: '' }),
    ).rejects.toThrow(/COOLIFY_APPLICATION_UUID/)
  })
})
