# Bunny CDN cache purge after production deploys

The site is served through **Bunny CDN** in front of the Coolify-hosted Node
server (SvelteKit, adapter-node, Docker). Bunny keeps serving stale content
until its pull-zone cache is invalidated, so each production deploy must purge
it. This document describes the one mechanism that does that, why it is shaped
the way it is, and how to operate it.

## Pipeline

```
push to main
   ├─ Coolify auto-deploys the app (GitHub webhook, production branch: main)
   └─ GitHub Actions: .github/workflows/purge-bunny-cache.yml
       1. scripts/wait-for-coolify-deploy.mjs   (wait-for-commit-marker)
       2. scripts/purge-bunny-cache.mjs         (POST /pullzone/{id}/purgeCache)
```

The workflow never purges at deploy-start and never purges blindly: it polls
the Coolify API (`GET /api/v1/deployments/applications/{uuid}`) until the
deployment for `GITHUB_SHA` reaches status `finished` (the exact commit is
serving), and only then purges the whole pull zone.

## Best practices this repo encodes

1. **Purge after the new code is serving, never at deploy-start and never
   blindly.** `wait-for-coolify-deploy.mjs` is the wait-for-commit-marker: it
   lists the app's deployments, matches `commit === GITHUB_SHA` (newest
   deployment wins), and returns only on status `finished`. On a Coolify API
   error, a `failed`/`cancelled-by-user` deployment, or a 20-minute timeout it
   **fails the job** instead of purging — a timeout means the cache may still
   be serving the previous build, and purging would be the purge-before-ready
   failure mode.

2. **Least-privilege key, kept out of the app runtime.** The purge uses the
   **pull-zone-scoped** Bunny API key (Bunny → Pull Zone → Security → API Key),
   which can only purge that zone, and a Coolify API token scoped to the app.
   Both exist **only** as GitHub Actions secrets (`BUNNY_API_KEY`,
   `COOLIFY_API_TOKEN`). They are never set in the Coolify application
   environment, never in `.env`, and never anywhere in the container. The pull
   zone id, Coolify URL and application uuid are configuration, not
   credentials: they live in GitHub Actions repository variables.

3. **One purge trigger per deploy event.** The workflow is the only purge
   trigger. There is deliberately **no in-container entrypoint**: the Docker
   image contains no purge script and no Bunny/Coolify credentials, so an
   entrypoint cannot fire alongside the workflow (double purge / competing
   guarantees). If a second trigger is ever added, it must be disabled by
   default and reserved for environments where CI cannot run.

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
   Coolify **deployment_success webhook** → a tiny serverless function that
   performs the same zone purge. The webhook only fires after the deployment
   finishes, so it correlates the purge with deployment completion — but its
   payload carries no commit SHA and cannot trigger `repository_dispatch`
   directly, so the serverless purger must validate the webhook and call the
   Bunny API itself. An in-container entrypoint is the last resort, not the
   second choice, and must ship disabled. Nothing like that exists in this
   repo today.

## Setup

1. **Bunny** → Pull Zone → Security → copy the pull zone **API Key**
   (zone-scoped; the least-privilege credential). Note the pull zone **id**.
2. **Coolify** → your application → copy the **application UUID** and your
   Coolify instance **URL**; create an API token (User → API tokens) with
   scope limited to this application.
3. **GitHub** → Settings → Secrets and variables → Actions:
   - Secrets: `BUNNY_API_KEY` (step 1), `COOLIFY_API_TOKEN` (step 2).
   - Variables: `BUNNY_PULL_ZONE_ID` (step 1), `COOLIFY_API_URL`,
     `COOLIFY_APPLICATION_UUID` (step 2).

The workflow runs on every push to `main` and is available manually via
`workflow_dispatch` (it waits for the latest main deploy to finish, then
purges).

## Local testing

```bash
# Wait script requires all inputs; safe to run against the real Coolify API:
COOLIFY_API_URL=<url> COOLIFY_API_TOKEN=<token> \
  COOLIFY_APPLICATION_UUID=<uuid> EXPECTED_COMMIT=<sha> \
  node scripts/wait-for-coolify-deploy.mjs

# Purge script: dev no-op without creds (loud skip, exit 0)
node scripts/purge-bunny-cache.mjs

# Purge script: real purge (204 expected) or loud failure
BUNNY_API_KEY=<zone-key> BUNNY_PULL_ZONE_ID=<id> node scripts/purge-bunny-cache.mjs

# CI-mode: missing creds are a hard failure (matches the workflow)
PURGE_REQUIRE_CREDS=1 node scripts/purge-bunny-cache.mjs
```

Unit tests: `scripts/purge-bunny-cache.unit.test.ts`,
`scripts/wait-for-coolify-deploy.unit.test.ts` (run with `npm run test`).

## Troubleshooting

- **Workflow fails on step 1 with `Coolify API responded 401`** → the
  `COOLIFY_API_TOKEN` is invalid or lacks scope for the application.
- **Workflow fails on step 1 with `Coolify API responded 404`** → wrong
  `COOLIFY_API_URL` or `COOLIFY_APPLICATION_UUID` variable.
- **Workflow fails on step 2 with `Bunny API responded 401`** → wrong
  `BUNNY_API_KEY` (or an account key was used instead of the zone-scoped key).
- **Workflow fails on step 2 with `Bunny API responded 404`** → wrong
  `BUNNY_PULL_ZONE_ID` variable.
- **`timed out after … waiting for commit …`** → Coolify never recorded a
  `finished` deployment for the commit within 20 minutes. Make sure Coolify is
  connected to this repo with a GitHub webhook (auto-deploy on push to main),
  so deployments record the commit SHA; check the app's deployment log.
  Nothing was purged, by design. See `docs/coolify-deployment.md` for the
  auto-deploy setup and the verify-then-trigger fallback pattern.
