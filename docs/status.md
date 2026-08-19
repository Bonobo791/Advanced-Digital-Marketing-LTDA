# Project status & remaining work

> Last updated: 2026-08-19 · PR #2 · branch `dev`

This file is the handoff for finishing this repository and completing the
Netlify → Coolify migration. It records what is done, what is left, and which
remaining items are owner/ops actions rather than code changes.

## TL;DR

The repository work is **essentially done and merge-ready**. The Coolify
migration is **complete in code and docs**. What remains is: (1) merging PR #2,
(2) fixing one GitHub-Copilot-agent check that fails for a tooling reason (not
code), and (3) performing the documented go-live steps in the Coolify / Bunny /
GitHub consoles.

---

## Current state

| Item | Status |
|---|---|
| PR #2 | OPEN, mergeable (`dev` → `main`, 30 commits, +9,834 / −850) |
| Branch protection on `main` | none |
| `npm run check` | 0 errors, 0 warnings |
| `npm run test` | 385 passed (31 files) |
| SonarCloud quality gate | **PASSED** |
| CodeQL | **PASSED** |
| `npm audit` | 0 vulnerabilities |
| OSV lockfile scan (363 packages) | 0 vulnerabilities |
| Local `dev` | `884b85e` (1 commit ahead of `origin/dev`; not pushed — AGENTS.md forbids the agent from pushing) |

---

## Done

### Code + review
- Five triage rounds fixed and replied to every bot review finding (Codex,
  CodeRabbit, CodeAnt, Codacy, SonarCloud). Highlights across the rounds:
  - Checkout/payment binding (website-build payments, subscriptions, and
    Stripe sessions are all bound to server-created references before any
    success claim).
  - Webhook retry semantics (Mercado Pago + Stripe): events are unmarked on
    failure and `processing_failed` maps to 5xx so redelivery retries instead
    of losing the owner notification.
  - Shared `buildQuote` pipeline for BRL/USD quotes; `authoritativeSubscriptionTotalBRL/USD`.
  - Contact opt-in: no-JS form fallback (303 redirect), sandbox guard in
    production, no-store verify pages, in-flight notification dedupe.
  - Dependency overrides (`cookie`, `nanoid`, `qs`) → 0 audit/OSV findings.
  - Service CTA routing (retainers → contact, per-option preselect).

### Coolify migration (repo side)
- `Dockerfile` — multi-stage `adapter-node` image: digest-pinned base,
  `npm ci --ignore-scripts`, `USER node`, container `HEALTHCHECK` against
  `/api/health`.
- `src/hooks.server.ts` + `src/lib/locale-edge.ts` — locale/geo routing that
  used to run at the Netlify edge now runs in the Node server.
- `.github/workflows/purge-bunny-cache.yml` + `scripts/wait-for-coolify-deploy.mjs`
  + `scripts/purge-bunny-cache.mjs` — wait-for-commit-marker + self-healing
  deploy trigger + Bunny pull-zone purge.
- Docs: `docs/coolify-deployment.md`, `docs/bunny-cdn-purge.md`,
  `docs/stripe-checkout.md`, `docs/contact-form.md`; `AGENTS.md` / `PRODUCT.md`
  / `.env.example` updated (incl. `ADDRESS_HEADER=X-Forwarded-For`,
  `XFF_DEPTH=1`).
- Removed: `netlify.toml`, `netlify/`, the `Edit(netlify/**)` permission, and
  the stale gitignored `.netlify/` artifacts.

---

## Remaining work

### 1. Merge PR #2
Open and mergeable; nothing blocks it technically (no required checks). Squash
or merge `dev` into `main` when ready.

### 2. Fix the failing "GitHub Advanced Security" check (tooling, not code)
This check is the **GitHub Copilot agentic PR reviewer**
(`ghas-code-scanning-agentic`). It fails with:

```
CAPIError: 400 The requested model is not supported  (model: claude-opus-4.6)
Failed to fetch previous Copilot comments: Bad credentials
```

Action (owner): in the repo's code-scanning / Copilot agent settings, switch
the agent to a model the account supports, or disable that agent. No repo
change can fix it.

### 3. Known analyzer noise (no action; do not re-litigate)
These stay "red" without any actionable code fix:
- **Codacy** "not up to standards": 2× `xss no-mixed-html` on test inputs, 1×
  `detect-unhandled-async-errors` heuristic on the intentional fail-loud wait
  script, Lizard complexity/nloc mis-attribution, and AGENTS.md operating rules.
- **CodeAnt** SCA/IAC "failed": stale — the lockfile is clean (`npm audit` 0 +
  OSV 0) and the IAC surface is fully pinned. Re-scan the new head or check the
  CodeAnt dashboard for the specific advisory if it persists.
- **CodeAnt** SAST `sensitive-data-in-url`: accepted by design — the double-opt-in
  link must carry its token in the URL (email clients cannot POST); it is a
  short-lived, single-purpose, idempotent HMAC.

---

## Coolify go-live checklist (owner/ops — in the consoles)

See `docs/coolify-deployment.md` and `docs/bunny-cdn-purge.md` for full detail.

- [ ] **Coolify** — create a **Dockerfile** application pointing at `main`.
- [ ] Set environment variables on the app:
      `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_SANDBOX_ACCESS_TOKEN`,
      `MERCADO_PAGO_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
      `MAILJET_API_KEY`, `MAILJET_API_SECRET`, `MAILJET_SENDER_EMAIL`,
      `CONTACT_FORM_TOKEN_SECRET` (`openssl rand -hex 32`),
      `CONTACT_FORM_OWNER_EMAIL`, `PUBLIC_SITE_URL`,
      `ADDRESS_HEADER=X-Forwarded-For`, `XFF_DEPTH=1`, `PORT=3000`,
      `ORIGIN=https://advanceddigitalmarketingltda.com`.
- [ ] Healthcheck → `GET /api/health` (or rely on the container `HEALTHCHECK`).
- [ ] **Bunny** — point the pull-zone **origin URL** at the Coolify app URL
      (DNS already targets Bunny).
- [ ] **GitHub** → Settings → Secrets and variables → Actions:
      secrets `BUNNY_API_KEY`, `COOLIFY_API_TOKEN`; variables
      `BUNNY_PULL_ZONE_ID`, `COOLIFY_API_URL`, `COOLIFY_APPLICATION_UUID`.
- [ ] Confirm the **GitHub → Coolify auto-deploy webhook** is connected (the
      purge workflow self-heals via `POST /api/v1/deploy` if the webhook misses
      a push, but it should be wired).
- [ ] Verify one deploy end-to-end: push to `main` → Coolify deploys → the
      Bunny-purge workflow waits for the commit to reach `finished`, then
      purges the pull zone.

---

## Recent triage commits (dev)

```
884b85e Remove the stale Edit(netlify/**) permission (Netlify migration complete)
9c33bff Clear the remaining require-await sleep mocks in the wait-script tests
957a9b2 Pin workflow runner and add Docker healthcheck (CodeAnt IAC)
aa3f673 Triage Codacy re-run on 41a8145: fix real alerts, decline artifacts
b2b026b Finish CodeRabbit round-5: site-url multi-dot hosts, locale rejection, test hardening
6113593 Pin the Docker base image by digest (CodeAnt IAC)
5fa3ce1 Resolve CodeRabbit round-5 findings: webhook retries, quote dedup, locale parity, docs
```
