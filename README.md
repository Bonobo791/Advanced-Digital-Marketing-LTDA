# Advanced Digital Marketing LTDA

Cyberpunk-themed marketing agency website. SvelteKit 2 + Svelte 5 (runes) + Tailwind CSS 3.4, deployed to Netlify with prerendered public pages and standard Node Functions.

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

Copy `.env.example` to `.env` and set `CRON_SECRET` when exercising `/api/cron` locally. For the checkout flow you also need `TURSO_DATABASE_URL` (Turso/libSQL — use `:memory:` for local testing) and the Mercado Pago credentials; see *Payments* below.

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

## Payments (Mercado Pago Checkout Pro)

One-time project checkout uses **Mercado Pago Checkout Pro (redirect)**: the customer stays on `/pricing` → `/checkout`, our backend creates the order and a Mercado Pago preference, and the customer pays on Mercado Pago's hosted checkout. No payment form (and no public key) is hosted on this site.

```text
/pricing or service CTA
  → /checkout?product=<slug>            customer/company details, CPF/CNPJ, terms
  → POST /api/checkout                  server-side:
       validate product → load active price from Turso → create order →
       create MP preference (external_reference = order id, back_urls,
       notification_url, auto_return) → return init_point
  → customer pays on Mercado Pago       Pix, card, boleto, balance
  → /checkout/success|pending|failure?order_id=...
  → GET /api/orders/[id]                success page only trusts the DB
  → POST /api/webhooks/mercadopago      signature-verified status updates
```

Never treat landing on `/success` as proof of payment: the result pages query `GET /api/orders/[id]` and only show *Pagamento confirmado* when the database (updated by the webhook) says `approved`.

### Pricing model

Prices are **versioned server-side data** in Turso, not source constants:

- `products` — catalog (slug, name, description, active)
- `prices` — append-only price rows (currency, `amount_cents`, `billing_type` `one_time|recurring`, `interval`, `active`, `effective_from/until`)
- `price_adjustments` — promotions (`percentage|fixed`), supported structurally but not yet exposed
- `orders` — snapshots the sold price (`price_id`, `product_name`, `amount_cents`, `subtotal_cents`, `discount_cents`, `total_cents`, `currency`, `promotion_id`) plus attribution and Mercado Pago state

A price change never mutates a historical row: deactivate the old `prices` row (`active = 0`, `effective_until`) and insert a new one. The browser only ever sends `productId`; the amount charged is always resolved server-side.

Apply the schema + seed to a fresh database with:

```bash
npm run db:migrate   # needs TURSO_DATABASE_URL / TURSO_AUTH_TOKEN
```

`getDb()` also applies schema + seed idempotently on every serverless cold start.

### Environment variables

```env
TURSO_DATABASE_URL=libsql://…
TURSO_AUTH_TOKEN=…
MERCADO_PAGO_ACCESS_TOKEN=TEST-…   # the only credential Checkout Pro needs server-side
MERCADO_PAGO_WEBHOOK_SECRET=…      # optional — see below
```

The **public key is not used** by the Checkout Pro redirect flow (it only exists for the frontend MercadoPago.js/Wallet Brick, which this site does not use). The **webhook secret is not part of the test credentials**: it is generated per application in *Suas integrações > Webhooks > Configure notifications* (Save reveals the secret). Configure both a test-mode and a production-mode URL for `https://<site>/api/webhooks/mercadopago`. When a secret is set, notifications carrying an `x-signature` are validated (HMAC, `data.id` from the URL); notifications delivered via the preference's `notification_url` are unsigned and are accepted too — in every case the payment is re-fetched from Mercado Pago with the access token before any order status change, so a forged or unsigned notification cannot fabricate a payment.

### Deferred (not implemented)

- **Conversion tracking** (GA4 / Google Ads / Meta purchase + Meta CAPI) — intentionally skipped for now; the success page is the single place to fire once, keyed by `order_id`
- Pending-order reconciliation (scheduled poll as a safety net for missed webhooks)
- Refund handling beyond status mapping, email receipts, CRM, NFS-e invoice workflow
- Recurring retainers (use Mercado Pago subscriptions, separate from this one-time flow)

Database (Turso / libSQL): development and production use the isolated databases `ADM-dev` and `ADM-prod` respectively.

## Image assets

The supplied Andrew portrait (`src/lib/assets/andrew.png`) is committed with the rest of the first-party visual assets. The sync hook only checks the optional generated `data-city.jpg` fallback when it is absent, so production builds do not depend on its remote URL.

## Structure

- `src/routes/` — Home (`+page.svelte`), `about/`, `contact/`, `pricing/` (+ `pt-br/` variants), `checkout/` + `checkout/success|pending|failure`
- `src/routes/api/cron/` — authenticated scheduled-job endpoint
- `src/routes/api/checkout/` — `POST /api/checkout` (order + MP preference)
- `src/routes/api/webhooks/mercadopago/` — signature-verified payment webhook
- `src/routes/api/orders/[id]/` — public order status lookup
- `src/lib/server/` — schema/seed, pricing (versioned), orders repository, Mercado Pago client, webhook signature validation
- `netlify/functions/` — Netlify scheduled function entrypoints
- `src/lib/components/cyber/` — boot blinds, CRT overlay, terminal typing, hover scramble, glitch word, scroll reveals
- `src/lib/components/chrome/` — nav and footer
- `src/app.css` — design tokens, chamfer clips, glitch/CRT/ledger styles, reduced-motion rules

## License

This website is under the PolyForm Shield 1.0.0 license.