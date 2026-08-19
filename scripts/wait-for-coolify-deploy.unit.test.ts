/**
 * Guards the wait-for-commit-marker contract (scripts/wait-for-coolify-deploy.mjs):
 * the purge must never run at deploy-start and never blindly — the script only
 * returns once the deployment for the expected commit is 'finished', and it
 * fails loudly on Coolify API errors, failed/cancelled deployments, or timeout
 * (never purging stale content).
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

const ok = (body) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }))

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
      apiUrl: 'https://coolify.example.com',
      apiToken: 't',
      applicationUuid: 'app-1',
      expectedCommit: 'sha1',
      fetchImpl,
    })
    expect(result.status).toBe('ready')
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://coolify.example.com/api/v1/deployments/applications/app-1',
      expect.objectContaining({ headers: { Authorization: 'Bearer t' } }),
    )
  })

  it('fails loudly when the Coolify API errors', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('unauthorized', { status: 401, statusText: 'Unauthorized' }),
    )
    await expect(
      waitForCoolifyDeploy({ apiUrl: 'https://coolify.example.com', apiToken: 'bad', applicationUuid: 'app-1', expectedCommit: 'sha1', fetchImpl }),
    ).rejects.toThrow(/401/)
  })

  it('fails loudly when the deployment fails or is cancelled', async () => {
    for (const status of ['failed', 'cancelled-by-user']) {
      const fetchImpl = ok([{ deployment_uuid: 'x', commit: 'sha1', status }])
      await expect(
        waitForCoolifyDeploy({ apiUrl: 'https://coolify.example.com', apiToken: 't', applicationUuid: 'app-1', expectedCommit: 'sha1', fetchImpl }),
      ).rejects.toThrow(new RegExp(status))
    }
  })

  it('times out loudly instead of purging against stale content', async () => {
    const fetchImpl = ok([{ deployment_uuid: 'x', commit: 'sha1', status: 'in_progress' }])
    let now = 0
    await expect(
      waitForCoolifyDeploy({
        apiUrl: 'https://coolify.example.com',
        apiToken: 't',
        applicationUuid: 'app-1',
        expectedCommit: 'sha1',
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
      waitForCoolifyDeploy({ apiUrl: '', apiToken: 't', applicationUuid: 'app-1', expectedCommit: 'sha1' }),
    ).rejects.toThrow(/COOLIFY_API_URL/)
    await expect(
      waitForCoolifyDeploy({ apiUrl: 'https://c.example.com', apiToken: '', applicationUuid: 'app-1', expectedCommit: 'sha1' }),
    ).rejects.toThrow(/COOLIFY_API_TOKEN/)
    await expect(
      waitForCoolifyDeploy({ apiUrl: 'https://c.example.com', apiToken: 't', applicationUuid: 'app-1', expectedCommit: '' }),
    ).rejects.toThrow(/EXPECTED_COMMIT/)
    await expect(
      waitForCoolifyDeploy({ apiUrl: 'https://c.example.com', apiToken: 't', applicationUuid: '', expectedCommit: 'sha1' }),
    ).rejects.toThrow(/COOLIFY_APPLICATION_UUID/)
  })
})
