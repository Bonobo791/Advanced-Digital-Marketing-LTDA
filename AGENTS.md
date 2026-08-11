# Repository Guidelines

## Rules

- NEVER develop on the default branch. ONLY work on the dev branch unless told otherwise.
- When I say "clean up", that means to clean your worktrees and branches.
- When I say "triage", review every PR comment for validity. Fix each valid issue. Post a triage comment. Reply to every bot comment, whether or not you make a code change.
- Always fail loudly. 
- NEVER write fallbacks that are silent.
- ALWAYS write fallbacks that are loud, log to the server, and show to the user.
- DO NOT copy and paste code. DO create reusable code.
- NEVER develop on the default branch/main. Always use dev.
- NEVER make changes to production databases. That is for humans only.
- Do not use swarm.

## Project Structure & Module Organization

This is a SvelteKit 2 / Svelte 5 site using TypeScript, Vite, and Tailwind CSS.

**Tech stack:** Node 24 / npm 11 · SvelteKit 2 + Svelte 5 (runes) · TypeScript (strict) · Vite 6 · Tailwind CSS 3 + PostCSS/autoprefixer · Fontsource (Archivo, JetBrains Mono, Overpass) · Vitest + fast-check (tests) · Stryker (mutation testing) · Netlify (adapter-netlify, Functions, Edge Functions) · Turso/libSQL (`@libsql/client`) · Mercado Pago (`mercadopago` SDK, Checkout Pro redirect flow).

- `src/routes/` — public pages (en + `pt-br/`, incl. `pricing/` and `checkout/` result pages) and `api/`: `checkout`, `webhooks/mercadopago`, `orders/[id]`, `cron`.
- `src/lib/components/` contains reusable `chrome` (navigation and footer), `cyber` (visual effects), and `pages` components.
- `src/lib/server/` — Turso/libSQL access (`db.ts`, `schema.mjs`/`seed.mjs`), versioned pricing, orders repository, Mercado Pago Checkout Pro client + webhook signature validation.
- `src/lib/` contains locale logic, constants, client helpers, and tests.
- `static/` contains public fonts and static assets; `src/lib/assets/` contains imported visual assets.
- `netlify/functions/` and `netlify/edge-functions/` contain deployment runtime code.
- `scripts/` contains `migrate.mjs` (db migration) and build-time asset synchronization. Do not edit generated `.svelte-kit/`, `build/`, or `reports/` output.

## Build, Test, and Development Commands

Use Node 24 and npm 11, as pinned by `package.json` and `netlify.toml`. On this dev box the default `node`/`npm` are distrobox wrappers that fail (podman is broken) — prepend a real Node 24 to `PATH` (e.g. `/tmp/node24/bin`).

```bash
npm install              # install the locked dependency set
npm run dev              # start the Vite development server
npm run check            # sync SvelteKit types and run svelte-check
npm run build            # sync assets and create the Netlify build
npm run test             # run all Vitest tests once
npm run test:unit        # run *.unit.test.ts tests
npm run test:integration # run *.integration.test.ts tests
npm run test:watch       # run Vitest interactively
npm run mutate           # run configured Stryker mutation tests
```

Copy `.env.example` to `.env`/`.env.local` and set `CRON_SECRET`, `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`, and `MERCADO_PAGO_ACCESS_TOKEN` (real credentials live in the gitignored `.env.local`). `npm run db:migrate` applies the Turso schema + seed and loads `.env`/`.env.local` itself.

## Coding Style & Naming Conventions

Use strict TypeScript and Svelte 5 runes where component state is needed. Match the existing style: two-space indentation, single quotes, no semicolons, trailing commas, and named exports for shared helpers. Use PascalCase for Svelte components, kebab-case for route directories, and descriptive camelCase for functions and variables. Keep locale-specific copy and route mappings centralized in `src/lib/constants.ts` and `src/lib/locale.ts`.

## Testing Guidelines

Tests use Vitest with a Node environment and live beside the code they exercise. Name unit tests `*.unit.test.ts` and endpoint or cross-module tests `*.integration.test.ts`. Add focused tests for routing, authentication, and other behavior changes; run `npm run check` and `npm run test` before opening a PR.

## Commit & Pull Request Guidelines

Use a short imperative subject, such as `Fix Netlify production build`, and keep each commit focused. PRs should explain the user-visible or operational change, link the relevant issue when one exists, list validation commands, and include screenshots or recordings for visual changes. Call out environment-variable or Netlify configuration changes explicitly.

## Security & Configuration

Never commit secrets. Configure `CRON_SECRET` in Netlify for production and verify changes to the authenticated cron route with both valid and invalid credentials. Payment flow: prices are resolved server-side from Turso (never trust client amounts); the Mercado Pago webhook is signature-validated when `MERCADO_PAGO_WEBHOOK_SECRET` is set and always re-fetches the payment before updating an order.
