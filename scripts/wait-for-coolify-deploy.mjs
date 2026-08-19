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
//   COOLIFY_TRIGGER_AFTER_MS   grace window before the self-healing deploy
//                              trigger fires when no deployment appeared
//                              (default 3 min; the documented webhook fallback)
import { fileURLToPath } from 'node:url'

const DEFAULT_POLL_INTERVAL_MS = 15_000
const DEFAULT_TIMEOUT_MS = 20 * 60_000
const DEFAULT_TRIGGER_AFTER_MS = 3 * 60_000

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

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** POSTs a deploy trigger for the application (documented webhook fallback). */
async function defaultDeploy(apiUrl, apiToken, applicationUuid) {
  const response = await fetch(
    `${apiUrl.replace(/\/+$/, '')}/api/v1/deploy?uuid=${encodeURIComponent(applicationUuid)}`,
    { method: 'POST', headers: { Authorization: `Bearer ${apiToken}` } },
  )
  if (!response.ok) {
    throw new Error(
      `[wait-for-coolify-deploy] FATAL: deploy trigger responded ${response.status} ${response.statusText}`,
    )
  }
  return response
}

/**
 * One poll of the deployments endpoint. The request (and its body reads) runs
 * under an abort signal tied to the remaining deadline, so a hung fetch or
 * response can never outlive the documented budget — the previous shape only
 * checked the deadline after the I/O completed and could hang forever.
 * Returns the classified state; throws on API/network/deadline failures.
 */
async function pollOnce({
  base,
  apiToken,
  applicationUuid,
  expectedCommit,
  applicationName,
  remainingMs,
  fetchImpl,
}) {
  const controller = new AbortController()
  const abortTimer = setTimeout(() => controller.abort(), remainingMs)
  try {
    const response = await fetchImpl(
      `${base}/api/v1/deployments/applications/${encodeURIComponent(applicationUuid)}`,
      {
        headers: { Authorization: `Bearer ${apiToken}` },
        signal: controller.signal,
      },
    )
    if (!response.ok) {
      throw new Error(
        `[wait-for-coolify-deploy] FATAL: Coolify API responded ${response.status} ${response.statusText}` +
          ' (check COOLIFY_API_URL and COOLIFY_API_TOKEN)',
      )
    }
    return resolveCoolifyDeployment(await response.json(), expectedCommit, { applicationUuid, applicationName })
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new Error(
        `[wait-for-coolify-deploy] FATAL: timed out after ${Math.round(remainingMs / 1000)}s of pending ` +
          'Coolify API I/O — refusing to purge',
      )
    }
    if (cause instanceof Error && cause.message.startsWith('[wait-for-coolify-deploy]')) throw cause
    throw new Error(`[wait-for-coolify-deploy] FATAL: Coolify API request failed: ${cause.message}`, { cause })
  } finally {
    clearTimeout(abortTimer)
  }
}

/** Builds the loud timeout error carrying the last-seen deployment state. */
function timeoutError(expectedCommit, timeoutMs, seen) {
  return new Error(
    `[wait-for-coolify-deploy] FATAL: timed out after ${Math.round(timeoutMs / 1000)}s waiting for ` +
      `commit ${expectedCommit} to finish deploying (last seen: ${seen}). ` +
      'Refusing to purge — the cache may still be serving the previous build. ' +
      'Make sure Coolify is connected to this repo with a webhook so deployments record the commit SHA.',
  )
}

/**
 * Polls Coolify until the expected commit is deployed; fails loudly otherwise.
 *
 * Self-healing (documented in docs/coolify-deployment.md): when the GitHub
 * webhook silently fails and no deployment for the commit appears within the
 * grace window, a deploy is triggered from CI (`POST /api/v1/deploy`) exactly
 * once, then polling continues for `finished` before the purge is allowed.
 * This never double-deploys when auto-deploy works.
 */
export async function waitForCoolifyDeploy({
  apiUrl,
  apiToken,
  expectedCommit,
  applicationUuid,
  applicationName,
  timing = {},
  test = {},
}) {
  if (!apiUrl) throw new Error('[wait-for-coolify-deploy] FATAL: COOLIFY_API_URL is not set')
  if (!apiToken) throw new Error('[wait-for-coolify-deploy] FATAL: COOLIFY_API_TOKEN is not set')
  if (!expectedCommit) throw new Error('[wait-for-coolify-deploy] FATAL: EXPECTED_COMMIT is not set')
  if (!applicationUuid) throw new Error('[wait-for-coolify-deploy] FATAL: COOLIFY_APPLICATION_UUID is not set')

  const {
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    triggerAfterMs = DEFAULT_TRIGGER_AFTER_MS,
  } = timing
  const { fetchImpl = fetch, now = Date.now, sleep = defaultSleep, deployImpl = defaultDeploy } = test

  const base = apiUrl.replace(/\/+$/, '')
  const deadline = now() + timeoutMs
  const startedAt = now()
  let attempts = 0
  let lastSeen = 'no deployment for this commit yet'
  let triggerSent = false

  for (;;) {
    attempts += 1
    const remainingMs = deadline - now()
    if (remainingMs <= 0) throw timeoutError(expectedCommit, timeoutMs, lastSeen)

    const result = await pollOnce({
      base,
      apiToken,
      applicationUuid,
      expectedCommit,
      applicationName,
      remainingMs,
      fetchImpl,
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
    lastSeen = result.status === 'not-found' ? 'no deployment for this commit yet' : `status ${result.state}`
    if (!triggerSent && result.status === 'not-found' && now() - startedAt >= triggerAfterMs) {
      await deployImpl(base, apiToken, applicationUuid)
      triggerSent = true
      console.log('[wait-for-coolify-deploy] auto-deploy webhook missed the push; triggered a deploy from CI')
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
      timing: {
        pollIntervalMs: Number(process.env.COOLIFY_POLL_INTERVAL_MS) || DEFAULT_POLL_INTERVAL_MS,
        timeoutMs: Number(process.env.COOLIFY_DEPLOY_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
        triggerAfterMs: Number(process.env.COOLIFY_TRIGGER_AFTER_MS) || DEFAULT_TRIGGER_AFTER_MS,
      },
    })
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
