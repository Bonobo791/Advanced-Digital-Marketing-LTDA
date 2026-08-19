// Wait-for-commit-marker for Coolify: polls the Coolify API deployments list
// until the deployment for the current commit is 'finished', then returns.
// The cache purge must never run at deploy-start and must never run blindly —
// it only runs after this script confirms the new code is actually serving.
//
//   COOLIFY_API_URL            Coolify instance URL, e.g. https://coolify.example.com
//   COOLIFY_API_TOKEN          Coolify API token (least-privilege, CI secret only)
//   COOLIFY_APPLICATION_UUID   Coolify application UUID (app-scoped deployments list)
//   COOLIFY_APPLICATION_NAME   optional: only consider deployments of this app name
//   EXPECTED_COMMIT            commit SHA that must be deployed (GITHUB_SHA)
//   COOLIFY_POLL_INTERVAL_MS   poll cadence (default 15s)
//   COOLIFY_DEPLOY_TIMEOUT_MS  overall budget before refusing to purge (default 20 min)
import { fileURLToPath } from 'node:url'

const DEFAULT_POLL_INTERVAL_MS = 15_000
const DEFAULT_TIMEOUT_MS = 20 * 60_000

// Coolify ApplicationDeploymentQueue status values (from the Coolify source):
const FINISHED = 'finished'
const FAILED_STATUSES = new Set(['failed', 'cancelled-by-user'])

/** Maps a Coolify deployments response to the state of the expected commit. */
export function resolveCoolifyDeployment(
  deployments,
  expectedCommit,
  { applicationUuid, applicationName } = {},
) {
  const matching = deployments
    .filter((deployment) => {
      if (deployment.commit !== expectedCommit) return false
      if (applicationUuid && deployment.application_uuid && deployment.application_uuid !== applicationUuid) return false
      if (applicationName && deployment.application_name && deployment.application_name !== applicationName) return false
      return true
    })
    .filter(Boolean)
    .sort((a, b) => String(b.updated_at ?? b.created_at ?? '').localeCompare(String(a.updated_at ?? a.created_at ?? '')))

  const deployment = matching[0]
  if (!deployment) return { status: 'not-found' }
  if (deployment.status === FINISHED) {
    return { status: 'ready', deploymentUuid: deployment.deployment_uuid }
  }
  if (FAILED_STATUSES.has(deployment.status)) {
    return {
      status: 'error',
      message: `Coolify deployment ${deployment.deployment_uuid} ended ${deployment.status} for commit ${expectedCommit}`,
    }
  }
  return { status: 'pending', state: deployment.status }
}

/** Polls Coolify until the expected commit is deployed; fails loudly otherwise. */
export async function waitForCoolifyDeploy({
  apiUrl,
  apiToken,
  expectedCommit,
  applicationUuid,
  applicationName,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  if (!apiUrl) throw new Error('[wait-for-coolify-deploy] FATAL: COOLIFY_API_URL is not set')
  if (!apiToken) throw new Error('[wait-for-coolify-deploy] FATAL: COOLIFY_API_TOKEN is not set')
  if (!expectedCommit) throw new Error('[wait-for-coolify-deploy] FATAL: EXPECTED_COMMIT is not set')
  if (!applicationUuid) throw new Error('[wait-for-coolify-deploy] FATAL: COOLIFY_APPLICATION_UUID is not set')

  const base = apiUrl.replace(/\/+$/, '')
  const deadline = now() + timeoutMs
  let attempts = 0
  while (true) {
    attempts += 1
    const url = `${base}/api/v1/deployments/applications/${encodeURIComponent(applicationUuid)}`
    let response
    try {
      response = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${apiToken}` },
      })
    } catch (cause) {
      throw new Error(
        `[wait-for-coolify-deploy] FATAL: Coolify API request failed: ${cause.message}`,
        { cause },
      )
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(
        `[wait-for-coolify-deploy] FATAL: Coolify API responded ${response.status} ${response.statusText}` +
          (body ? ` — ${body.slice(0, 300)}` : '') +
          ' (check COOLIFY_API_URL and COOLIFY_API_TOKEN)',
      )
    }
    const result = resolveCoolifyDeployment(await response.json(), expectedCommit, {
      applicationUuid,
      applicationName,
    })
    if (result.status === 'ready') {
      console.log(
        `[wait-for-coolify-deploy] ok   commit ${expectedCommit} is deployed` +
          (result.deploymentUuid ? ` (deployment ${result.deploymentUuid})` : '') +
          ` after ${attempts} poll(s)`,
      )
      return result
    }
    if (result.status === 'error') {
      throw new Error(`[wait-for-coolify-deploy] FATAL: ${result.message}`)
    }
    if (now() >= deadline) {
      const seen =
        result.status === 'not-found'
          ? 'no deployment for this commit yet'
          : `status ${result.state}`
      throw new Error(
        `[wait-for-coolify-deploy] FATAL: timed out after ${Math.round(timeoutMs / 1000)}s waiting for ` +
          `commit ${expectedCommit} to finish deploying (last seen: ${seen}). ` +
          'Refusing to purge — the cache may still be serving the previous build. ' +
          'Make sure Coolify is connected to this repo with a webhook so deployments record the commit SHA.',
      )
    }
    await sleep(pollIntervalMs)
  }
}

// Run only when executed directly (importing from tests must not trigger it).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await waitForCoolifyDeploy({
      apiUrl: process.env.COOLIFY_API_URL,
      apiToken: process.env.COOLIFY_API_TOKEN,
      expectedCommit: process.env.EXPECTED_COMMIT,
      applicationUuid: process.env.COOLIFY_APPLICATION_UUID,
      applicationName: process.env.COOLIFY_APPLICATION_NAME,
      pollIntervalMs:
        Number(process.env.COOLIFY_POLL_INTERVAL_MS) || DEFAULT_POLL_INTERVAL_MS,
      timeoutMs: Number(process.env.COOLIFY_DEPLOY_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    })
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
