# Mercado Pago Checkout

Two hosted-checkout flows, both with **Mercado Pago as the system of record**
(there is no local billing database):

1. **Subscriptions** — monthly mix-and-match services via Mercado Pago's hosted
   *subscription* checkout. Customers select recurring services, see the
   monthly total, enter their email, and are redirected to Mercado Pago, where
   the subscription is created, paid, and managed.
2. **One-time website builds** — the web-development page's flipper configurator
   charges a fixed one-time price through Checkout Pro, and the hosting
   subscription below it recurs monthly.

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

```text
Website build flippers (tipo + migração)
    ↓  POST /api/checkout/build
Server validates type + kind (never trusts a client amount)
    ↓  POST https://api.mercadopago.com/checkout/preferences
Mercado Pago creates a one-time Checkout Pro preference
    ↓  returns id + init_point (sandbox-aware)
Browser is redirected to Mercado Pago's hosted payment checkout
    ↓
Customer pays once; Mercado Pago redirects to /pt-br/checkout/complete?payment_id=…
    ↓  GET /v1/payments/{payment_id} verifies status === "approved"
```

The design principle:

```text
Our website:   service selection + pricing logic
Our server:    validate + create subscription
Mercado Pago:  customer + subscription + checkout + payments + recurring billing + management
```

---

## Architecture

- **Stack:** SvelteKit 2 / Svelte 5 (runes), adapter-node (Docker on Coolify). Pages are
  server-rendered; the checkout endpoint runs on the Node server.
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
  model), creates one-time Checkout Pro preferences via
  `POST /checkout/preferences`, validates every returned `init_point` (HTTPS +
  Mercado Pago hostname), and exposes sanitized `getSubscription()` /
  `getPayment()` proxies for the return page.
- **Endpoints:** `src/routes/api/checkout/subscription/+server.ts` (POST,
  monthly) and `src/routes/api/checkout/build/+server.ts` (POST, one-time
  website build).
- **UI:** `src/lib/components/pages/SubscribeSection.svelte` (monthly
  configurator) mounted on the services gateway (`/services/`,
  `/pt-br/servicos/`) and on each subscribable service page (EN + PT), and
  `src/lib/components/pages/WebsiteBuildPricing.svelte` (one-time build
  purchase with the type/migration flippers). Option-card CTAs on service
  pages scroll to the relevant pricing section (`#builds` / `#subscribe`)
  instead of opening mailto links.
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

### One-time website build pricing

| Choice | BRL (checkout) | USD reference |
|---|---|---|
| Website — new | R$ 3.000 | $750 |
| Website — migration | R$ 6.000 | $1,500 |
| Ecommerce — new | R$ 6.000 | $1,500 |
| Ecommerce — migration | R$ 12.000 | $3,000 |

The authoritative BRL table lives in `WEBSITE_BUILD_BASE_PRICE_BRL`
(`src/lib/website-builds.ts`); the pt-BR display prices must equal it
(guarded by `website-builds.unit.test.ts`). The en-US prices are a separate
USD reference and are never billed (no USD checkout yet).

### Payment methods (hosted Checkout Pro)

The one-time build preference carries an explicit `payment_methods` block
(`WEBSITE_BUILD_CHECKOUT_PAYMENT_METHODS` in `src/lib/website-builds.ts`,
server-side only — the browser never sends it):

- **Offered methods:** credit card (`credit_card`), debit card
  (`debit_card`), Pix / bank transfer (`bank_transfer`) and boleto
  (`ticket`).
- **Credit installments:** à vista is preselected
  (`default_installments: 1`); buyers may split the payment into up to
  12 installments (`installments: 12`).
- **Exclusions:** `excluded_payment_types: [{ "id": "prepaid_card" }]`
  removes every other Checkout Pro payment type. Mercado Pago's wallet
  (`account_money`, "Dinheiro em conta") **cannot be excluded by
  preference** and stays available.

---

## Environment variables

Both checkout flows (subscriptions and one-time website builds) read the same
three server-only variables from `process.env` inside
`src/lib/server/mercadoPago.ts`; they are never exposed to the browser.

| Variable | Dev (sandbox) | Prod (live) |
|---|---|---|
| `MERCADO_PAGO_ACCESS_TOKEN` | **Test** Access Token from the panel's *Credenciais de teste* section (also `APP_USR-...` — the environment is the panel section, not the prefix). | **Production** Access Token from *Credenciais de produção*. |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Any value (webhooks are off in test). | Secret from the panel's webhook configuration — verifies `POST /api/webhooks/mercadopago` signatures. Without it the webhook endpoint refuses with 503. |
| `MERCADO_PAGO_SANDBOX_ACCESS_TOKEN` | Set to the **same test token** — exact equality with the access token is how sandbox mode is detected (`selectInitPoint` then uses `sandbox_init_point`, which Checkout Pro returns). | **Do not set** (or set to a different value). If it equals the production token, every real customer is redirected to the sandbox checkout and payments fail. |
| `PUBLIC_SITE_URL` | Any public HTTPS domain MP accepts — the production domain works for local testing (`localhost`/non-public hosts are rejected by MP). | `https://advanceddigitalmarketingltda.com` — base for the `back_url` redirect to `/pt-br/checkout/complete/`. Falls back to the `SITE_ORIGIN` constant with a loud server-side warning if unset/malformed/not public HTTPS. |

The token is read only inside `src/lib/server/mercadoPago.ts` and never appears
in API responses, HTML, or logs. Do **not** add a Mercado Pago public key —
this redirect flow needs none. Do not prefix any of these with `PUBLIC_` for
`import.meta.env` access.

**Client ID / Client Secret are not needed** (prod or dev). Mercado Pago only
uses them for OAuth-based integrations — the `client_credentials` grant to
mint an Access Token programmatically (`POST /oauth/token`) or the
authorization-code flow for marketplace/third-party access. This integration
uses the static Access Token from the panel directly and performs no OAuth;
the codebase never reads these values. (Test credentials do not even expose a
Client ID/Secret pair.)

> Note: local `.env` files are gitignored. The current dev `.env` follows the
> dev row above (test token in both variables — the account resolves to a
> seller **test user**, `TESTUSER...`, tagged `test_user` in
> `GET /users/me`). `PUBLIC_KEY` in `.env` belongs to a different application
> — ignore it. `MERCADO_PAGO_WEBHOOK_SECRET` is only read by the webhook
> endpoint.

---

## Mercado Pago application setup

1. Log in to the Mercado Pago account used by this site (Brazil).
2. Create an application in the Mercado Pago Developer panel
   (`https://www.mercadopago.com.br/developers/panel/app`).
3. Copy the **Access Token** (production) into `MERCADO_PAGO_ACCESS_TOKEN` on
   Coolify (Application → Environment Variables) and locally.
4. Confirm **Subscriptions** is enabled for the application
   (Subscriptions → Integration → create a subscription).
5. Add `https://<site>/pt-br/checkout/complete/` to the application's
   *Redirect URLs* if the panel asks for them.

### Test credentials

1. In the same panel, open **Credenciais de teste** (test credentials are also
   `APP_USR-...` — the environment is determined by the panel section, not the
   prefix).
2. Set `MERCADO_PAGO_ACCESS_TOKEN` and `MERCADO_PAGO_SANDBOX_ACCESS_TOKEN` to
   the **same** test Access Token, and `PUBLIC_SITE_URL` to a public HTTPS
   domain accepted by Mercado Pago (see the environment-variable note above).
3. Run `npm run test` (all Mercado Pago calls are mocked — no real requests).
4. For a live sandbox end-to-end check, run `npm run dev` and use a **real
   browser** (the sandbox checkout's invisible reCAPTCHA blocks automated
   browsers):
   - **Subscription flow** — enter a `@testuser.com` email in the pt-BR
     configurator (sandbox requires the buyer to be a test account; a real
     email makes Mercado Pago return `500` on `/preapproval`) and submit.
   - **Website build flow** — click *Comprar site* and pay as a guest
     ("Sem conta Mercado Pago") with a current test card (no test-user email
     needed for Checkout Pro).

### Current test cards (Brazil, 2026)

The card list changes — always re-check
[Cartões de teste](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/cards).
Verified working with this account:

| Result | Card | Holder name | CPF | Expiry | CVV |
|---|---|---|---|---|---|
| Approved | `5480 8328 0103 3311` (Mastercard) or `4235 6477 2802 5682` (Visa) | `APRO` | `12345678909` | `11/30` | `123` |
| Declined | any of the above | `OTHE` | `12345678909` | `11/30` | `123` |

> The previously documented card `5031 4332 1540 6351` is **no longer
> accepted** by Mercado Pago (rejected live with "Não é possível pagar com
> este cartão"). Do not use it.

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
| 503 | `missing_credentials`, `timeout`, `client_address_unavailable` |

Unexpected errors are re-thrown so the server logs them (Coolify container logs).

### `POST /api/checkout/build` (one-time website build)

Request:

```json
{
  "type": "ecommerce",
  "kind": "migration",
  "idempotencyKey": "00000000-0000-4000-8000-000000000000",
  "locale": "pt-BR"
}
```

- `type` — `website` or `ecommerce` (unknown values are rejected).
- `kind` — `new` or `migration` (migration bills 2×).
- `idempotencyKey` — UUID v4, same duplicate-submission guard as subscriptions.
- `locale` — only selects the item-title language; **no amount field exists** —
  the server derives the one-time BRL price from `type` + `kind`.

Server procedure:

1. Validate `type`/`kind` and the idempotency key.
2. Derive the authoritative amount from `WEBSITE_BUILD_BASE_PRICE_BRL` × the
   migration multiplier (browser manipulation cannot change the billed amount).
3. Build the item title (e.g. `Desenvolvimento de Site E-commerce (Migração)`)
   and `external_reference` (e.g. `website-build:ecommerce:migration`,
   deterministic, no PII).
4. `POST https://api.mercadopago.com/checkout/preferences` with one item,
   the `payment_methods` block (offered methods + à vista/parcelado policy,
   see [Payment methods](#payment-methods-hosted-checkout-pro)), `back_urls`
   (all three states → `/pt-br/checkout/complete/`),
   `auto_return: "approved"`.
5. Validate the returned `init_point` (HTTPS, Mercado Pago host; sandbox-aware
   via `sandbox_init_point` when the sandbox token matches) and respond.

Response: `{ "checkoutUrl": "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=…" }`

Error responses reuse the subscription codes plus `invalid_build` (400). The
UI only renders the purchase button on pt-BR pages (Mercado Pago bills BRL);
en-US pages show the informational email CTA until the Stripe checkout lands.

---

## Return page

`/pt-br/checkout/complete/` — the Mercado Pago `back_url`. It is **not**
prerendered: a server load function (`+page.server.ts`) verifies the redirect
before claiming success.

Mercado Pago's hosted checkouts append identifiers to the `back_url`; the
load function verifies them live against the API (no local state):

- **subscriptions** — `preapproval_id` → `getSubscription()` (see below);
- **one-time builds** — `payment_id` (legacy `collection_id`) → `getPayment()`
  (`GET /v1/payments/{id}`).

It renders one of:

- **confirmed** — subscription: only when the preapproval status is
  `authorized`; payment: only when the payment status is `approved`
  (`Sua assinatura foi processada.` / `Seu pagamento foi aprovado.` plus the
  reference);
- **pending / cancelled / payment_unconfirmed** — any other status — the page
  never claims success for these (a one-time payment that is not `approved`
  renders `payment_unconfirmed`);
- **rate_limited** — too many verification requests from the same client in a
  short window (throttled with the same per-IP limiter as subscription
  creation; the page asks the customer to wait and retry);
- **error / missing** — no `preapproval_id` on the URL, the API rejected the
  token, or the preapproval was not found (logged loudly server-side).

The page does not persist any local state and does not trust browser query
parameters as proof of payment on its own — the status is fetched from Mercado
Pago. The page stays `noindex` and transient.

Abuse protection runs before any outbound call: requests carrying a
`preapproval_id` or `payment_id` are throttled per client IP (same in-memory
limiter; separate buckets `subscriptionVerify` and `paymentVerify`, and
`buildCreate` for the build endpoint, so traffic on one entry point never
exhausts another's budget), and identifiers that fail a conservative shape
check (only `[A-Za-z0-9_-]`, max 128 chars) are rejected without touching the
Mercado Pago API.

## Webhooks

`POST /api/webhooks/mercadopago` receives Mercado Pago event notifications
(`src/lib/server/mercadoPago-webhook.ts`).

- **Signature:** `x-signature` (`ts=…,v1=…`) verified with
  `MERCADO_PAGO_WEBHOOK_SECRET` (HMAC-SHA256 over
  `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`), with a 5-minute
  timestamp recency check so a captured request cannot be replayed. A missing
  secret returns 503 (operator misconfiguration, MP retries); a bad signature
  returns 401 before any work.
- **Action:** the single handoff that matters — email the owner when a
  `payment` is `approved` or a `preapproval` (subscription) is `authorized`.
  There is still no local billing database; everything else stays in Mercado
  Pago.
- **Redelivery:** MP retries non-2xx webhooks, so events are deduped in
  memory by `type:data.id` (24 h window, bounded) — a replayed event is
  acknowledged without a second owner email.
- **Setup:** add the webhook to the Mercado Pago panel (Application →
  Webhooks → URL `https://<site>/api/webhooks/mercadopago`) with the payment
  and preapproval events, and set `MERCADO_PAGO_WEBHOOK_SECRET` on Coolify.

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
  amount, for subscriptions or for one-time builds (covered by integration
  tests, including literal `total: 1` / `amount: 1` attacks).
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
- If the client IP cannot be resolved at all (`getClientAddress()` throws and
  no proxy header is present), the request is **refused** with HTTP 503 +
  `client_address_unavailable` rather than pooling unidentified clients into a
  single rate-limit bucket — ten valid attempts from any customers would
  otherwise exhaust the shared bucket and 429 unrelated visitors
  (AGENTS.md: no silent fallbacks).

## Analytics

Before redirecting, the client pushes a `begin_checkout` event to
`window.dataLayer` when Google Tag Manager is present
(`{ event, currency, value, items: [{ item_id, item_name }] }`). A `purchase`
conversion fires on the return page ONLY when the server has verified the
payment/subscription live against the API (`confirmed`/`payment_confirmed`),
with the verified amount and reference, deduped per id in sessionStorage so a
refresh or revisit cannot double-count.

---

## Testing

```bash
npm run check      # svelte-check, strict TS
npm run test       # all unit + integration tests (Mercado Pago is mocked)
npm run build      # adapter-node build; confirms SSR pages + API routes
```

Coverage highlights:

- Pricing: one/multiple/all services, invalid + inactive ids, quote-only
  rejection, ad-spend rule at/below/above the R$ 500 minimum, zero totals,
  `reason`/`external_reference` shapes; build prices for every type × kind
  combo against `WEBSITE_BUILD_BASE_PRICE_BRL` (including the pt-BR display
  sync guard).
- Checkout: valid creation, invalid email/json/spend/idempotency-key, MP
  401/5xx/timeout, missing `init_point`, hostile `init_point` host, duplicate
  submission (same idempotency key), the end-to-end tamper test proving the
  server price reaches Mercado Pago (`subscription-flow.integration.test.ts`),
  and the build endpoint's invalid type/kind rejection + server-priced
  preference (`build.integration.test.ts`). Return page: subscription and
  payment verification, malformed-id rejection, per-bucket rate limits.

## Troubleshooting

- **`missing_credentials` (503):** `MERCADO_PAGO_ACCESS_TOKEN` not set on the
  function environment.
- **`unauthorized` (502):** token missing the `offline_access`/subscriptions
  scope, expired, or not enabled for Subscriptions in the panel.
- **`api_error` (502):** MP returned a non-2xx; the server log now includes the
  MP response body (`[mercadoPago] api_error (HTTP ...): ...`). Verified causes
  on this account:
  - `400 invalid_field_content` — `back_url` domain rejected by MP
    (`localhost` and non-public hosts are disallowed; use a public HTTPS
    domain).
  - `500 Internal server error` on `/preapproval` — the `payer_email` is not a
    sandbox test user. In sandbox, the buyer email must be a test account on
    `@testuser.com`; a real email makes MP fail with 500.
- **Redirecting to sandbox unexpectedly:** `MERCADO_PAGO_SANDBOX_ACCESS_TOKEN`
  equals the access token — intended in test environments, remove in prod. For
  Checkout Pro (website builds) the equality is what selects
  `sandbox_init_point`, so in prod it must not equal the production token. For
  Subscriptions the API only ever returns `init_point`; the environment there
  is determined by the credential itself.
- **Back URL wrong:** set `PUBLIC_SITE_URL` to a public HTTPS domain Mercado
  Pago accepts (e.g. `https://advanceddigitalmarketingltda.com` — not
  `localhost` or non-public hosts); otherwise the canonical `SITE_ORIGIN`
  constant is used with a server-side warning.
- **USD prices on EN pages:** display-only reference; checkout always charges
  BRL (MP Subscriptions does not support USD from this account).
- **"Sob consulta" on AI Automation:** by design — quote-only services are
  never billed through this flow.
- **Response lost after Mercado Pago created the subscription:** the
  idempotency key is regenerated whenever the checkout payload (email,
  services, ad spend) changes, and reused only while the payload is identical —
  so a plain retry cannot duplicate the subscription, and an edited retry gets
  a fresh one instead of the stale preapproval.
