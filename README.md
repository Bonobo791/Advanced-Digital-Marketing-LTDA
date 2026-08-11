# Advanced Digital Marketing LTDA

Cyberpunk-themed marketing agency website. SvelteKit 2 + Svelte 5 (runes) + Tailwind CSS 3.4, deployed to Netlify with prerendered public pages.

**Owner / operator:** Andrew Philip Weilbacher
**Services:** SEO & GEO, Paid Search, Paid Social, Web Design
**Registered office:** SAO PAULO, SP
**Contact:** contact@AdvancedDigitalMarketingLTDA.com

## Develop

```bash
npm install
npm run check
npm run dev
```

Copy `.env.example` to `.env` and set `TURSO_DATABASE_URL` (Turso/libSQL — use `:memory:` for local testing) so the pricing page reads products and prices from the database.

## Build

```bash
npm run build
```

The public pages remain prerendered.

## Test and quality checks

```bash
npm run test
npm run mutate
```

Vitest covers unit/property tests and endpoint integration tests. fast-check is available to tests only; Stryker runs mutation testing through its Vitest runner.

## Pricing model

Prices are **versioned server-side data** in Turso, not source constants:

- `products` — catalog (slug, name, description, active)
- `prices` — append-only price rows (currency, `amount_cents`, `billing_type` `one_time|recurring`, `interval`, `active`, `effective_from/until`)
- `price_adjustments` — promotions (`percentage|fixed`), supported structurally but not yet exposed

A price change never mutates a historical row: deactivate the old `prices` row (`active = 0`, `effective_until`) and insert a new one.

Apply the schema + seed to a fresh database with:

```bash
npm run db:migrate   # needs TURSO_DATABASE_URL / TURSO_AUTH_TOKEN
```

`getDb()` also applies schema + seed idempotently on every serverless cold start.

### Environment variables

```env
TURSO_DATABASE_URL=libsql://…
TURSO_AUTH_TOKEN=…
```

Database (Turso / libSQL): development and production use the isolated databases `ADM-dev` and `ADM-prod` respectively.

## Image assets

The supplied Andrew portrait (`src/lib/assets/andrew.png`) is committed with the rest of the first-party visual assets. The sync hook only checks the optional generated `data-city.jpg` fallback when it is absent, so production builds do not depend on its remote URL.

## Structure

- `src/routes/` — Home (`+page.svelte`), `about/`, `contact/`, `pricing/` (+ `pt-br/` variants)
- `src/lib/server/` — schema/seed, versioned pricing, product lookup
- `src/lib/components/pages/` — Home, About, Contact, Pricing page components
- `src/lib/components/cyber/` — boot blinds, CRT overlay, terminal typing, hover scramble, glitch word, scroll reveals
- `src/lib/components/chrome/` — nav and footer
- `src/app.css` — design tokens, chamfer clips, glitch/CRT/ledger styles, reduced-motion rules

## License

This website is under the PolyForm Shield 1.0.0 license.
