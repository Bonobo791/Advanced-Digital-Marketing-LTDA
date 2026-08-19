# Bunny CDN cache purge after production deploys

The site is served through **Bunny CDN** in front of the Netlify origin. Netlify
purges its own CDN automatically on deploy, but the Bunny pull zone in front of
it keeps serving stale content until its cache is invalidated. This document
describes the one mechanism that invalidates it, why it is shaped the way it is,
and how to operate it.

## Pipeline

```
push to main
   ├─ Netlify builds + deploys (production branch: main)
   └─ GitHub Actions: .github/workflows/purge-bunny-cache.yml
       1. scripts/wait-for-netlify-deploy.mjs   (wait-for-commit-marker)
       2. scripts/purge-bunny-cache.mjs         (POST /pullzone/{id}/purgeCache)
```

The workflow never purges at deploy-start and never purges blindly: it first
polls the Netlify API until the deploy for `GITHUB_SHA` reaches state `ready`
(the exact commit is serving), and only then purges the whole pull zone.

## Best practices this repo encodes

1. **Purge after the new code is serving, never at deploy-start and never
   blindly.** `wait-for-netlify-deploy.mjs` is the wait-for-commit-marker: it
   resolves the deploy list for the site, matches `commit_ref === GITHUB_SHA`
   on the production branch, and returns only on state `ready`. On a Netlify
   API error, a deploy `error` state, or a 20-minute timeout it **fails the
   job** instead of purging — a timeout means the cache may still be serving
   the previous build, and purging would be the purge-before-ready failure
   mode.

2. **Least-privilege key, kept out of the app runtime.** The purge uses the
   **pull-zone-scoped** Bunny API key (Pull Zone → Security → API Key), which
   can only purge that zone. The key exists **only** as the GitHub Actions
   secret `BUNNY_API_KEY`. It is never set in Netlify environment variables,
   never in `.env`, and never anywhere in the application runtime. The pull
   zone id and Netlify site id are configuration, not credentials: they live
   in GitHub Actions repository variables.

3. **One purge trigger per deploy event.** The workflow is the only purge
   trigger. There is deliberately **no in-container entrypoint**: an
   entrypoint firing alongside the workflow would mean double purges and two
   competing guarantees. If a second trigger is ever added, it must be
   disabled by default and reserved for environments where CI cannot run.

4. **Fail loudly, never silently.** `purge-bunny-cache.mjs` treats missing
   creds as a loud dev no-op (exit 0, explicit log line) when
   `PURGE_REQUIRE_CREDS` is unset. The workflow always sets
   `PURGE_REQUIRE_CREDS=1`, which turns missing creds into a hard failure, and
   any non-204 response or network error aborts the job with the HTTP status
   and body excerpt. A red checkmark is the intended outcome when the purge
   cannot be guaranteed.

5. **CI-less fallback: deployment webhook → serverless purger, not an
   in-container entrypoint.** If this repo ever deploys from an environment
   where the workflow cannot run, the preferred out-of-container path is the
   Netlify **deploy-succeeded outgoing webhook** → a tiny Netlify Function that
   performs the same zone purge. That keeps the key out of the container and
   correlates the purge with deployment completion (the webhook only fires
   after the deploy is live — the wait-for-commit-marker for free). An
   in-container entrypoint is the last resort, not the second choice, and must
   ship disabled. Nothing like that exists in this repo today.

## Setup

1. **Bunny** → Pull Zone → Security → copy the pull zone **API Key**
   (zone-scoped; this is the least-privilege credential). Note the pull zone
   **id** (an integer; shown in the dashboard URL/API).
2. **Netlify** → User settings → Applications → Personal access tokens →
   create a token with read access to deploys.
3. **GitHub** → Settings → Secrets and variables → Actions:
   - Secrets: `BUNNY_API_KEY` (from step 1), `NETLIFY_AUTH_TOKEN` (step 2).
   - Variables: `BUNNY_PULL_ZONE_ID` (Bunny pull zone id),
     `NETLIFY_SITE_ID` (current value: `de65ea1d-42e3-48d9-a1d1-2f2223a438cc`,
     site `adm-ltda`, domain `advanceddigitalmarketingltda.com`).

The workflow runs on every push to `main` and is also available manually via
`workflow_dispatch` (it waits for the latest main deploy to be live, then
purges).

## Local testing

```bash
# Wait script requires all inputs; safe to run against the real Netlify API:
NETLIFY_SITE_ID=<id> NETLIFY_AUTH_TOKEN=<token> \
  EXPECTED_COMMIT=<sha> node scripts/wait-for-netlify-deploy.mjs

# Purge script: dev no-op without creds (loud skip, exit 0)
node scripts/purge-bunny-cache.mjs

# Purge script: real purge (204 expected) or loud failure
BUNNY_API_KEY=<zone-key> BUNNY_PULL_ZONE_ID=<id> node scripts/purge-bunny-cache.mjs

# CI-mode: missing creds are a hard failure (matches the workflow)
PURGE_REQUIRE_CREDS=1 node scripts/purge-bunny-cache.mjs
```

Unit tests: `scripts/purge-bunny-cache.unit.test.ts`,
`scripts/wait-for-netlify-deploy.unit.test.ts` (run with `npm run test`).

## Troubleshooting

- **Workflow fails on step 1 with `Netlify API responded 401`** → the
  `NETLIFY_AUTH_TOKEN` is invalid or lacks deploy read scope.
- **Workflow fails on step 1 with `Netlify API responded 404`** → wrong
  `NETLIFY_SITE_ID` variable.
- **Workflow fails on step 2 with `Bunny API responded 401`** → wrong
  `BUNNY_API_KEY` (or an account key was used instead of the zone-scoped key).
- **Workflow fails on step 2 with `Bunny API responded 404`** → wrong
  `BUNNY_PULL_ZONE_ID` variable.
- **`timed out after … waiting for commit …`** → Netlify did not reach
  `ready` within 20 minutes (build failure, stuck queue, or wrong
  `EXPECTED_COMMIT`). Nothing was purged, by design. Check the Netlify
  deploys page; fix the build and re-deploy.
