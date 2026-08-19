// Purges the Bunny CDN pull zone after the new deploy is confirmed serving.
// Runs only from CI (the GitHub Actions workflow) — the pull-zone-scoped API
// key never lives in the application runtime.
//
//   BUNNY_API_KEY        pull-zone-scoped Bunny API key (Pull Zone -> Security)
//   BUNNY_PULL_ZONE_ID   numeric pull zone id
//   PURGE_REQUIRE_CREDS  1/true = missing creds are a hard failure (CI mode);
//                        unset = loud no-op for local dev runs
import { fileURLToPath } from 'node:url'

const BUNNY_API = 'https://api.bunny.net'

/** Reads and validates the purge configuration from the environment. */
export function buildPurgeConfig(env = process.env) {
  const apiKey = (env.BUNNY_API_KEY ?? '').trim()
  const pullZoneId = (env.BUNNY_PULL_ZONE_ID ?? '').trim()
  const requireCreds =
    env.PURGE_REQUIRE_CREDS === '1' || env.PURGE_REQUIRE_CREDS === 'true'
  return { apiKey, pullZoneId, requireCreds }
}

/** Purges the whole pull zone; throws loudly on any non-204 or network error. */
export async function purgePullZone({ apiKey, pullZoneId, fetchImpl = fetch }) {
  let response
  try {
    response = await fetchImpl(
      `${BUNNY_API}/pullzone/${encodeURIComponent(pullZoneId)}/purgeCache`,
      {
        method: 'POST',
        headers: { AccessKey: apiKey },
      },
    )
  } catch (cause) {
    throw new Error(
      `[purge-bunny-cache] FATAL: purge request failed: ${cause.message}`,
      { cause },
    )
  }
  if (response.status !== 204) {
    // Status/statusText only — never the response body: the API could echo
    // request data, and CI logs must stay free of externally controlled
    // content (SonarCloud: jssecurity:S5145).
    throw new Error(
      `[purge-bunny-cache] FATAL: Bunny API responded ${response.status} ${response.statusText}` +
        ` for pull zone ${pullZoneId}`,
    )
  }
  return response.status
}

/** Entry point: dev no-op without creds, loud hard failure in CI mode. */
export async function main(env = process.env, fetchImpl = fetch) {
  const { apiKey, pullZoneId, requireCreds } = buildPurgeConfig(env)
  if (!apiKey || !pullZoneId) {
    const missing = [
      apiKey ? null : 'BUNNY_API_KEY',
      pullZoneId ? null : 'BUNNY_PULL_ZONE_ID',
    ]
      .filter(Boolean)
      .join(', ')
    if (requireCreds) {
      throw new Error(
        `[purge-bunny-cache] FATAL: ${missing} not set — refusing to skip the purge in CI. ` +
          'The production cache would keep serving stale content.',
      )
    }
    console.log(
      `[purge-bunny-cache] skip ${missing} not set — dev no-op ` +
        '(set PURGE_REQUIRE_CREDS=1 in CI to make this a failure)',
    )
    return 0
  }
  const status = await purgePullZone({ apiKey, pullZoneId, fetchImpl })
  console.log(`[purge-bunny-cache] ok   purged pull zone ${pullZoneId} (HTTP ${status})`)
  return 0
}

// Run only when executed directly (importing from tests must not trigger it).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.exitCode = await main()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
