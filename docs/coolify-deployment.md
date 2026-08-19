# Coolify deployment

This site runs as a Docker container on a self-hosted **Coolify** instance,
built from the repo's `Dockerfile` (SvelteKit 2 / Svelte 5, `adapter-node`).
Pages are **server-rendered** (SSR); the API routes (`/api/checkout/*`,
`/api/contact/submit`, `/api/health`) run on the same Node server inside the
container.

## Why Coolify + adapter-node

- Netlify's adapter and edge functions are gone: the locale routing that used
  to run at the Netlify edge now runs in `src/hooks.server.ts` (see
  `src/lib/locale-edge.ts`), reading the visitor country from CDN-forwarded
  headers (`Bunny-Country`, `x-country-code`, `CF-IPCountry`, `x-geo-country`).
- **Why SSR and not prerendering:** adapter-node serves prerendered files
  straight from disk, bypassing the SvelteKit `handle` hook — the locale
  redirect and `geo_br` cookie logic in `src/hooks.server.ts` would silently
  stop running. With `prerender = false` every page flows through `handle`,
  preserving the exact behavior the Netlify edge function provided, and Bunny
  CDN caches the rendered HTML at the edge.

## One-time setup in Coolify

1. **Create the application**: New resource → Dockerfile. Point it at this
   repository and the production branch (`main`).
2. **Build type**: Dockerfile (the repo ships one). The image listens on
   `PORT` (default `3000`); set `PORT=3000` on the application or let the
   default stand, and make sure the app's exposed port matches.
3. **Auto-deploy**: connect Coolify to GitHub with a webhook so pushes to
   `main` deploy automatically. Coolify records the commit SHA on each
   deployment, which the cache-purge workflow waits for. If the webhook is
   ever unreliable, see the verify-then-trigger fallback below.
4. **Environment variables** (Application → Environment Variables) — never
   baked into the image; `.env` is excluded via `.dockerignore`:
   - `MERCADO_PAGO_ACCESS_TOKEN` (and `MERCADO_PAGO_SANDBOX_ACCESS_TOKEN` for
     test mode), `MERCADO_PAGO_WEBHOOK_SECRET`, `PUBLIC_MERCADO_PAGO_PUBLIC_KEY`
   - `MAILJET_API_KEY`, `MAILJET_API_SECRET`, `MAILJET_SENDER_EMAIL`,
     `MAILJET_SENDER_NAME`, `MAILJET_SANDBOX_MODE`
   - `CONTACT_FORM_TOKEN_SECRET` (`openssl rand -hex 32`),
     `CONTACT_FORM_OWNER_EMAIL`
   - `PUBLIC_SITE_URL=https://advanceddigitalmarketingltda.com`
   - Recommended: `ORIGIN=https://advanceddigitalmarketingltda.com` so
     SvelteKit generates absolute URLs from the canonical origin.
   Full descriptions: `docs/mercado-pago-subscriptions.md`,
   `docs/contact-form.md`, `.env.example`.
5. **Healthcheck**: point Coolify's healthcheck at `GET /api/health` (returns
   `200 {"status":"ok"}`; no side effects, no secrets).
6. **Bunny CDN**: change the pull zone's **origin URL** from the old Netlify
   host to the Coolify app URL (the app's HTTPS domain or the Coolify
   container URL). DNS on `advanceddigitalmarketingltda.com` keeps pointing at
   Bunny. Optionally add an Edge Rule that forwards the visitor country as a
   header (e.g. `Bunny-Country`) so the geo-based language suggestion keeps
   working.
7. **Cache purge**: configure the GitHub Actions secrets/variables listed in
   `docs/bunny-cdn-purge.md` (`COOLIFY_API_URL`, `COOLIFY_API_TOKEN`,
   `COOLIFY_APPLICATION_UUID`, `BUNNY_PULL_ZONE_ID`, `BUNNY_API_KEY`).

## What the container does

- `Dockerfile` multi-stage: `node:24-alpine` build stage (`npm ci` →
  `npm run build` → `npm prune --omit=dev`), slim runtime stage with only
  `build/`, production `node_modules/` and `package.json`. Start command:
  `node build`.
- adapter-node keeps production `dependencies` external, so the runtime image
  carries `node_modules` (production only). Dev tooling and secrets never
  enter the image (`.dockerignore` excludes `.env*`, `.git`, `node_modules`,
  build artifacts, IDE/tool state).
- API routes resolve the client IP from `X-Forwarded-For` (set by the
  Coolify reverse proxy) for rate limiting; make sure trusted-proxy forwarding
  is enabled so the per-IP rate limit keeps working.

## Verify-then-trigger fallback (auto-deploy webhook died)

If pushes stop auto-deploying (the Coolify GitHub webhook silently failing is
the known failure mode), trigger a deploy from CI and keep the purge
guarantee:

- On push, the purge workflow polls `GET /api/v1/deployments/applications/{uuid}`
  for the commit. If no deployment appears within a grace window, call
  `POST /api/v1/deploy?uuid=<app-uuid>` to start one, then continue waiting
  for `finished` before purging. This never double-deploys when auto-deploy
  works and self-heals when it does not.

## Rollback

- Code rollback: redeploy an older commit from the Coolify UI, then purge the
  Bunny cache (manual `workflow_dispatch` on the workflow, or
  `node scripts/purge-bunny-cache.mjs` with the env above).
- The container is stateless (in-memory rate-limit and verification maps
  reset on restart); production data lives in third-party services (Mercado
  Pago, MailJet), never in the container.
