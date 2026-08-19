// Wait-for-commit-marker: blocks until the Netlify deploy for the current
// commit is live ('ready'), then returns. The cache purge must never run at
// deploy-start and must never run blindly — it only runs after this script
// confirms the new code is actually serving.
//
//   NETLIFY_SITE_ID            Netlify site id (Site configuration -> Site details)
//   NETLIFY_AUTH_TOKEN         Netlify personal access token (read deploys)
//   EXPECTED_COMMIT            commit SHA that must be serving (GITHUB_SHA)
//   EXPECTED_BRANCH            production branch to match (default: main)
//   NETLIFY_POLL_INTERVAL_MS   poll cadence (default 15s)
//   NETLIFY_DEPLOY_TIMEOUT_MS  overall budget before refusing to purge (default 20 min)
import { fileURLToPath } from 'node:url'

const NETLIFY_API = 'https://api.netlify.com/api/v1'
const DEFAULT_POLL_INTERVAL_MS = 15_000
const DEFAULT_TIMEOUT_MS = 20 * 60_000

/** Maps a Netlify deploys response to the state of the expected commit. */
export function resolveDeployState(deploys, expectedCommit, expectedBranch) {
  const deploy = deploys.find(
    (candidate) =>
      candidate.commit_ref === expectedCommit &&
      (!expectedBranch || candidate.branch === expectedBranch),
  )
  if (!deploy) return { status: 'not-found' }
  if (deploy.state === 'ready') {
    return { status: 'ready', url: deploy.deploy_ssl_url ?? deploy.url ?? null }
  }
  if (deploy.state === 'error') {
    return {
      status: 'error',
      message:
        deploy.error_message ??
        `Netlify deploy for ${expectedCommit} failed (state: error)`,
    }
  }
  return { status: 'pending', state: deploy.state }
}

/** Polls Netlify until the expected commit is live; fails loudly otherwise. */
export async function waitForDeploy({
  siteId,
  authToken,
  expectedCommit,
  expectedBranch = 'main',
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  if (!siteId) {
    throw new Error('[wait-for-netlify-deploy] FATAL: NETLIFY_SITE_ID is not set')
  }
  if (!authToken) {
    throw new Error('[wait-for-netlify-deploy] FATAL: NETLIFY_AUTH_TOKEN is not set')
  }
  if (!expectedCommit) {
    throw new Error('[wait-for-netlify-deploy] FATAL: EXPECTED_COMMIT is not set')
  }

  const deadline = now() + timeoutMs
  let attempts = 0
  while (true) {
    attempts += 1
    const url = `${NETLIFY_API}/sites/${encodeURIComponent(siteId)}/deploys?per_page=100`
    let response
    try {
      response = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
    } catch (cause) {
      throw new Error(
        `[wait-for-netlify-deploy] FATAL: Netlify API request failed: ${cause.message}`,
        { cause },
      )
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(
        `[wait-for-netlify-deploy] FATAL: Netlify API responded ${response.status} ${response.statusText}` +
          (body ? ` — ${body.slice(0, 300)}` : '') +
          ' (check NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID)',
      )
    }
    const result = resolveDeployState(
      await response.json(),
      expectedCommit,
      expectedBranch,
    )
    if (result.status === 'ready') {
      console.log(
        `[wait-for-netlify-deploy] ok   commit ${expectedCommit} is live` +
          (result.url ? ` at ${result.url}` : '') +
          ` (after ${attempts} poll(s))`,
      )
      return result
    }
    if (result.status === 'error') {
      throw new Error(`[wait-for-netlify-deploy] FATAL: ${result.message}`)
    }
    if (now() >= deadline) {
      const seen =
        result.status === 'not-found'
          ? 'no matching deploy yet'
          : `state ${result.state}`
      throw new Error(
        `[wait-for-netlify-deploy] FATAL: timed out after ${Math.round(timeoutMs / 1000)}s waiting for ` +
          `commit ${expectedCommit} to reach state 'ready' (last seen: ${seen}). ` +
          'Refusing to purge — the cache may still be serving the previous build.',
      )
    }
    await sleep(pollIntervalMs)
  }
}

// Run only when executed directly (importing from tests must not trigger it).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await waitForDeploy({
      siteId: process.env.NETLIFY_SITE_ID,
      authToken: process.env.NETLIFY_AUTH_TOKEN,
      expectedCommit: process.env.EXPECTED_COMMIT,
      expectedBranch: process.env.EXPECTED_BRANCH,
      pollIntervalMs:
        Number(process.env.NETLIFY_POLL_INTERVAL_MS) || DEFAULT_POLL_INTERVAL_MS,
      timeoutMs: Number(process.env.NETLIFY_DEPLOY_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    })
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
