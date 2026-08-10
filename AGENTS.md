# Repository Guidelines

## Rules

- NEVER develop on the default branch. ONLY work on the dev branch unless told otherwise.
- When I say "clean up", that means to clean your worktrees and branches.
- When I say "triage", review every PR comment for validity. Fix each valid issue. Post a triage comment. Reply to every bot comment, whether or not you make a code change.

## Project Structure & Module Organization

This is a SvelteKit 2 / Svelte 5 site using TypeScript, Vite, and Tailwind CSS.

- `src/routes/` contains English and Portuguese pages plus the `/api/cron` endpoint.
- `src/lib/components/` contains reusable `chrome` (navigation and footer), `cyber` (visual effects), and page components.
- `src/lib/` contains locale logic, constants, server code, and tests.
- `static/` contains public fonts and static assets; `src/lib/assets/` contains imported visual assets.
- `netlify/functions/` and `netlify/edge-functions/` contain deployment runtime code.
- `scripts/` contains build-time asset synchronization. Do not edit generated `.svelte-kit/`, `build/`, or `reports/` output.

## Build, Test, and Development Commands

Use Node 24 and npm 11, as pinned by `package.json` and `netlify.toml`.

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

Copy `.env.example` to `.env` and set `CRON_SECRET` when testing the cron endpoint locally.

## Coding Style & Naming Conventions

Use strict TypeScript and Svelte 5 runes where component state is needed. Match the existing style: two-space indentation, single quotes, no semicolons, trailing commas, and named exports for shared helpers. Use PascalCase for Svelte components, kebab-case for route directories, and descriptive camelCase for functions and variables. Keep locale-specific copy and route mappings centralized in `src/lib/constants.ts` and `src/lib/locale.ts`.

## Testing Guidelines

Tests use Vitest with a Node environment and live beside the code they exercise. Name unit tests `*.unit.test.ts` and endpoint or cross-module tests `*.integration.test.ts`. Add focused tests for routing, authentication, and other behavior changes; run `npm run check` and `npm run test` before opening a PR.

## Commit & Pull Request Guidelines

Use a short imperative subject, such as `Fix Netlify production build`, and keep each commit focused. PRs should explain the user-visible or operational change, link the relevant issue when one exists, list validation commands, and include screenshots or recordings for visual changes. Call out environment-variable or Netlify configuration changes explicitly.

## Security & Configuration

Never commit secrets. Configure `CRON_SECRET` in Netlify for production and verify changes to the authenticated cron route with both valid and invalid credentials.
