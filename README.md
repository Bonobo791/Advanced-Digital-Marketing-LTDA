# Advanced Digital Marketing LTDA

Cyberpunk-themed marketing agency website. SvelteKit 2 + Svelte 5 (runes) + Tailwind CSS 3.4, deployed to Netlify with prerendered public pages and standard Node Functions.

**Owner / operator:** Andrew Philip Weilbacher
**Services:** SEO & GEO, Paid Search, Paid Social, Web Design
**Registered office:** SAO PAULO, SP
**Contact:** contact@marketingprowess.simplelogin.com

## Develop

```bash
npm install
npm run check
npm run dev
```

Copy `.env.example` to `.env` and set `CRON_SECRET` when exercising `/api/cron` locally.

## Build

```bash
npm run build
```

The public pages remain prerendered. Netlify serves the dynamic `/api/cron` endpoint as a standard Node Function and runs `netlify/functions/cron.mts` every minute in production.

## Test and quality checks

```bash
npm run test
npm run mutate
```

Vitest covers unit/property tests and endpoint integration tests. fast-check is available to tests only; Stryker runs mutation testing through its Vitest runner.

## Netlify environment

Set `CRON_SECRET` in the production Netlify environment. The scheduled function uses Netlify's `URL` value and sends the secret in the `x-cron-secret` header to `GET /api/cron`.

Database integration is intentionally deferred. When it is introduced, development and production will use the isolated Turso databases `ADM-dev` and `ADM-prod` respectively.

## Image assets

The two AI-generated images (`andrew-portrait.jpg`, `data-city.jpg`) are committed so production builds do not depend on remote asset URLs. `scripts/sync-assets.mjs` (wired as `predev` / `prebuild`) only downloads them when they are absent.

If those URLs ever expire, place the two `.jpg` files manually in `src/lib/assets/` with the exact filenames above. The sync script skips any file that already exists.

## Structure

- `src/routes/` — Home (`+page.svelte`), `about/`, `contact/`
- `src/routes/api/cron/` — authenticated scheduled-job endpoint
- `netlify/functions/` — Netlify scheduled function entrypoints
- `src/lib/components/cyber/` — boot blinds, CRT overlay, terminal typing, hover scramble, glitch word, scroll reveals
- `src/lib/components/chrome/` — nav and footer
- `src/app.css` — design tokens, chamfer clips, glitch/CRT/ledger styles, reduced-motion rules
