# Mercado Pago Subscriptions

Monthly mix-and-match subscriptions via Mercado Pago's **hosted subscription
checkout**. Customers select recurring services, see the monthly total, enter
their email, and are redirected completely off this site to Mercado Pago, where
the subscription is created, paid, and managed. **Mercado Pago is the system of
record for subscriptions and billing** — there is no local billing database.

```text
Service selector (Monte seu pacote)
    ↓  POST /api/checkout/subscription
Server validates selections + configuration
    ↓
Server recalculates the authoritative monthly price (never trusts the browser)
    ↓  POST https://api.mercadopago.com/preapproval
Mercado Pago creates + stores the subscription (status: pending)
    ↓  returns id + init_point
Browser is redirected to Mercado Pago's hosted checkout
    ↓
Customer authorizes the payment method on Mercado Pago
    ↓
Customer returns to /pt-br/checkout/complete
```

The design principle:

```text
Our website:   service selection + pricing logic
Our server:    validate + create subscription
Mercado Pago:  customer + subscription + checkout + payments + recurring billing + management
```

---

## Architecture

- **Stack:** SvelteKit 2 / Svelte 5 (runes), adapter-netlify. Pages are
  prerendered; the checkout endpoint runs as a Netlify Function.
- **Catalog:** `src/lib/catalog.ts` — the single source of truth for what can be
  subscribed to and what it costs. Isomorphic (no secrets); the client uses it
  only to *display* prices.
- **Pricing:** `src/lib/server/pricing.ts` — authoritative recalculation. The
  browser sends only `serviceIds` + configuration; the server computes the
  total, the human-readable `reason`, and the deterministic
  `external_reference`. A client-supplied `total` is never read.
- **Mercado Pago client:** `src/lib/server/mercadoPago.ts` — all MP API access
  is isolated here. Creates subscriptions without an associated plan via
  `POST /preapproval` (`status: "pending"` = hosted checkout, pending-payment
  model), validates the returned `init_point` (HTTPS + Mercado Pago hostname),
  and exposes a sanitized `getSubscription()` proxy.
- **Endpoint:** `src/routes/api/checkout/subscription/+server.ts` (POST).
- **UI:** `src/lib/components/pages/SubscribeSection.svelte` mounted on the
  services gateway (`/services/`, `/pt-br/servicos/`) and on each subscribable
  service page (EN + PT).
- **No local billing database.** No ORM. No payment tables. No webhooks (see
  below).

### Service catalog and pricing rules

| Catalog id | Service | Pricing |
|---|---|---|
| `seo-content` | SEO Content (Conteúdo SEO) | Fixed: R$ 2.000/month (US$ 400 reference) |
| `backlinks` | Backlinks | Fixed: R$ 3.000/month (US$ 600 reference) |
| `hosting` | Hosting (Hospedagem) | Fixed: R$ 300/month (US$ 60 reference), maintenance + site changes included |
| `paid-search` | Google Ads Management | Dynamic: 10% of monthly ad spend, **R$ 500 minimum** |
| `meta-ads` | Meta Ads Management | Dynamic: 10% of monthly ad spend, **R$ 500 minimum** |
| `ai-automation` | AI Automation | Quote only — never part of checkout |

Rules live in one place: `ADS_SPEND_RULE` in `src/lib/catalog.ts`
(`rate: 0.1`, `minimumBRL: 500`). The ad-spend fee is
`max(monthlyAdSpend × 10%, R$ 500)` and is always recalculated on the server.

The currency is **BRL only**. Mercado Pago Subscriptions is available in
AR/BR/CL/CO/MX/PE/UY — there is no USD subscription checkout from this
(Brazilian) account. English pages are informational (USD amounts shown as a
reference); an English checkout via **Stripe is planned future work** and is
not implemented here.

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `MERCADO_PAGO_ACCESS_TOKEN` | Yes | Server-only Mercado Pago access token (production `APP_USR-...` or test `TEST-...`). Never expose client-side. |
| `MERCADO_PAGO_SANDBOX_ACCESS_TOKEN` | For sandbox | When it equals the access token, the client uses `sandbox_init_point` (test mode). |
| `PUBLIC_SITE_URL` | Yes (prod) | Base URL used for the `back_url` redirect back to `/pt-br/checkout/complete/`. Falls back to the `SITE_ORIGIN` constant with a loud server-side warning if unset or malformed (a malformed value is never echoed in logs). |

The token is read only inside `src/lib/server/mercadoPago.ts` and never appears
in API responses, HTML, or logs. Do **not** add a Mercado Pago public key —
this redirect flow needs none. Do not prefix any of these with `PUBLIC_` for
`import.meta.env` access.

> Note: local `.env` files are gitignored. For local development, set
> `MERCADO_PAGO_ACCESS_TOKEN=TEST-...` (test credentials) — do **not** copy
> production credentials into a local `.env`. `MERCADO_PAGO_WEBHOOK_SECRET`
> and `PUBLIC_KEY` in `.env` are unused by this flow.

---

## Mercado Pago application setup

1. Log in to the Mercado Pago account used by this site (Brazil).
2. Create an application in the Mercado Pago Developer panel
   (`https://www.mercadopago.com.br/developers/panel/app`).
3. Copy the **Access Token** (production) into `MERCADO_PAGO_ACCESS_TOKEN` on
   Netlify (Site settings → Environment variables) and locally.
4. Confirm **Subscriptions** is enabled for the application
   (Subscriptions → Integration → create a subscription).
5. Add `https://<site>/pt-br/checkout/complete/` to the application's
   *Redirect URLs* if the panel asks for them.

### Test credentials

1. In the same panel, generate **Test credentials** (they start with `TEST-`).
2. Set `MERCADO_PAGO_ACCESS_TOKEN=TEST-...` and
   `MERCADO_PAGO_SANDBOX_ACCESS_TOKEN=TEST-...` (same value) in the test
   environment. The client then redirects to Mercado Pago's sandbox
   (`sandbox.mercadopago.com.br`) with test cards
   (e.g. `5031 4332 1540 6351`).
3. Run `npm run test` (all Mercado Pago calls are mocked — no real requests).
4. For a live sandbox end-to-end check, run `npm run dev` and click through the
   pt-BR configurator; the browser should land on Mercado Pago's sandbox
   checkout, where the subscription is created in **test** mode.

Production credentials are used only when `MERCADO_PAGO_ACCESS_TOKEN` is a
production token. **Never run a real (non-sandbox) checkout in development.**

---

## Checkout endpoint

### `POST /api/checkout/subscription`

Request:

```json
{
  "email": "customer@example.com",
  "serviceIds": ["seo-content", "paid-search"],
  "config": {
    "paid-search": { "monthlyAdSpend": 10000 }
  },
  "idempotencyKey": "00000000-0000-4000-8000-000000000000",
  "locale": "pt-BR"
}
```

- `serviceIds` — catalog ids the customer selected (unknown, inactive, or
  quote-only ids are rejected).
- `config` — `{ monthlyAdSpend }` (BRL, 0–1.000.000) required for each selected
  ads service; everything else is ignored.
- `idempotencyKey` — a UUID generated by the client (`crypto.randomUUID`) and
  **reused only while the checkout payload is unchanged**: if the customer
  changes the selection or ad spend, the key is regenerated so a retry never
  binds them to a stale package; retrying the *same* payload reuses the key so
  Mercado Pago's `X-Idempotency-Key` dedupes it (no database involved).
- No `total` field exists — the server derives the amount from the catalog.

Server procedure (spec §4):

1. Validate email (`src/lib/server/checkout.ts`).
2. Validate service ids, activeness, quote-only, ad-spend values
   (`src/lib/server/pricing.ts`).
3. Load prices from the catalog, apply the ad-spend rule, sum the monthly
   total.
4. Build `reason` (e.g. `Conteúdo SEO + Gestão de Google Ads`) and
   `external_reference` (e.g. `seo-content+paid-search`, deterministic catalog
   order, never contains secrets or PII).
5. `POST https://api.mercadopago.com/preapproval` with
   `auto_recurring { frequency: 1, frequency_type: "months", transaction_amount: <server total>, currency_id: "BRL" }`,
   `payer_email`, `back_url`, `status: "pending"`.
6. Validate the returned `init_point` (HTTPS, Mercado Pago host) and respond.

Response:

```json
{ "checkoutUrl": "https://www.mercadopago.com.br/subscriptions/checkout?..." }
```

The frontend calls `window.location.assign(checkoutUrl)` — a full-page
redirect, so the address bar visibly shows Mercado Pago. Mercado Pago's page is
never iframed or proxied, and this site never collects card data (no Checkout
Transparente / embedded card form).

### Error responses

Machine-readable codes with stable HTTP statuses; the UI maps them to clean
Portuguese messages. No stack traces, tokens, headers, or MP internals are ever
returned:

| Status | Error codes |
|---|---|
| 400 | `invalid_json`, `invalid_email`, `invalid_idempotency_key`, `invalid_service`, `service_unavailable`, `quote_only_service`, `invalid_ad_spend`, `no_services_selected` |
| 502 | `unauthorized`, `api_error`, `invalid_response`, `missing_init_point`, `invalid_init_point` |
| 503 | `missing_credentials`, `timeout` |

Unexpected errors are re-thrown so the server logs them (Sentry/Netlify logs).

---

## Return page

`/pt-br/checkout/complete/` — the Mercado Pago `back_url`. It is **not**
prerendered: a server load function (`+page.server.ts`) verifies the redirect
before claiming success.

Mercado Pago's hosted checkout appends `preapproval_id` to the `back_url`; the
load function calls `getSubscription(preapproval_id)` (live API, no local
state) and renders one of:

- **confirmed** — only when the preapproval status is `authorized`
  (`Sua assinatura foi processada.` plus the subscription reference);
- **pending** — any other status (`paused`, `cancelled`, ...) — the page never
  claims success for these;
- **error / missing** — no `preapproval_id` on the URL, the API rejected the
  token, or the preapproval was not found (logged loudly server-side).

The page does not persist any local state and does not trust browser query
parameters as proof of payment on its own — the status is fetched from Mercado
Pago. The page stays `noindex` and transient.

## Webhooks

Intentionally **not implemented**: there is no local billing database to sync,
and no application-side action (onboarding email, CRM, access grant) depends on
subscription events today. If one is added later, validate Mercado Pago webhook
signatures properly and keep the handler to that single action.

---

## Inspecting and managing subscriptions

All subscription/payment management lives in Mercado Pago:

- **Panel:** Mercado Pago → Subscriptions (Subscriptions → Subscriptions list)
  shows each customer, amount, status, payment history, and lets you pause,
  cancel, or update a subscription.
- **API:** `GET /preapproval/search`, `GET /preapproval/{id}`,
  `PUT /preapproval/{id}`, `GET /authorized_payments/search`,
  `GET /v1/payments/search` — all behind `Authorization: Bearer <access token>`.

A sanitized status proxy is used by the return page for verification:
`getSubscription(id)` in `src/lib/server/mercadoPago.ts` returns only
`id`, `status`, `reason`, `external_reference`, `payer_email`,
`transaction_amount`, `currency_id` — nothing is cached locally. It maps
HTTP 401/403 to `unauthorized` and requires a string `id` in the response.

`reason` (`Conteúdo SEO + Backlinks + Hospedagem...`) and
`external_reference` (`seo-content+backlinks+hosting`) make each subscription
understandable inside Mercado Pago without any local database.

---

## Security checklist

- Server-side pricing only — browser manipulation cannot change the billed
  amount (covered by integration tests, including a literal `total: 1` attack).
- Strict service-id / config validation; quote-only and inactive services are
  rejected.
- Access token is server-only (`src/lib/server/mercadoPago.ts`), never exposed.
- `init_point` validated: HTTPS + `*.mercadopago.com[.br]` before redirecting.
- No card information ever touches this application.
- Duplicate submissions: client button disabled while pending + MP
  `X-Idempotency-Key` from a per-payload UUID.
- Abuse protection: a short-lived per-IP rate limit (10 requests / 60 s,
  `src/lib/server/rate-limit.ts`) rejects excess checkout creations with HTTP
  429 + `Retry-After` before the paid Mercado Pago call. Limitation: it is
  in-memory per serverless instance (no shared store) — it raises the cost of
  abuse without adding infrastructure; if real abuse appears, move the limit
  to a shared store or a platform/WAF rule.

## Analytics

Before redirecting, the client pushes a `begin_checkout` event to
`window.dataLayer` when Google Tag Manager is present
(`{ event, currency: "BRL", value, items: [{ item_id, item_name }] }`). It is a
no-op when no `dataLayer` exists (logged with `console.info`). A purchase
conversion is deliberately **not** fired on the return page — only reliable
Mercado Pago payment/webhook data should ever drive that.

---

## Testing

```bash
npm run check      # svelte-check, strict TS
npm run test       # all unit + integration tests (Mercado Pago is mocked)
npm run build      # Netlify build; confirms prerender/function split
```

Coverage highlights:

- Pricing: one/multiple/all services, invalid + inactive ids, quote-only
  rejection, ad-spend rule at/below/above the R$ 500 minimum, zero totals,
  `reason`/`external_reference` shapes.
- Checkout: valid creation, invalid email/json/spend/idempotency-key, MP
  401/5xx/timeout, missing `init_point`, hostile `init_point` host, duplicate
  submission (same idempotency key), and the end-to-end tamper test proving the
  server price reaches Mercado Pago (`subscription-flow.integration.test.ts`).

## Troubleshooting

- **`missing_credentials` (503):** `MERCADO_PAGO_ACCESS_TOKEN` not set on the
  function environment.
- **`unauthorized` (502):** token missing the `offline_access`/subscriptions
  scope, expired, or not enabled for Subscriptions in the panel.
- **`api_error` (502):** MP returned a non-2xx; check MP logs. If the account
  cannot create preapprovals without a plan, enable "Subscriptions" for the app.
- **Redirecting to sandbox unexpectedly:** `MERCADO_PAGO_SANDBOX_ACCESS_TOKEN`
  equals the access token — intended in test environments, remove in prod.
- **Back URL wrong:** set `PUBLIC_SITE_URL` (e.g.
  `https://advanceddigitalmarketingltda.com`); otherwise the canonical
  `SITE_ORIGIN` constant is used with a server-side warning.
- **USD prices on EN pages:** display-only reference; checkout always charges
  BRL (MP Subscriptions does not support USD from this account).
- **"Sob consulta" on AI Automation:** by design — quote-only services are
  never billed through this flow.
- **Response lost after Mercado Pago created the subscription:** the
  idempotency key is regenerated whenever the checkout payload (email,
  services, ad spend) changes, and reused only while the payload is identical —
  so a plain retry cannot duplicate the subscription, and an edited retry gets
  a fresh one instead of the stale preapproval.
