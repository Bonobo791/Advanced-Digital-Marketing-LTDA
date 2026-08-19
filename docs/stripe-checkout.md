# Stripe checkout (en-US, USD)

Mercado Pago bills BRL from the Brazilian account, so English pages get a
**Stripe hosted Checkout** billed in USD. This is the previously-planned
"Stripe is future work" piece, now implemented.

## How it works

```
en-US configurator / build button
    ↓  POST /api/checkout/stripe  { flow: 'subscription' | 'build', ... }
Server validates selections and derives USD amounts (never trusts the browser)
    ↓  POST https://api.stripe.com/v1/checkout/sessions
Stripe creates a hosted Checkout Session (subscription or one-time payment)
    ↓  returns id + url (https://checkout.stripe.com/...)
Browser is redirected to Stripe's hosted checkout
    ↓
Customer pays; Stripe redirects to /checkout/complete?session_id=…
    ↓  GET /v1/checkout/sessions/{id} verifies payment_status === 'paid'
```

- **Pricing:** subscriptions use the catalog's stored USD references or the
  5:1 reference rate (`BRL_USD_REFERENCE_RATE`); the ads fee is
  `max(spendUSD × 10%, $100)` (`adSpendFeeUSD`). One-time builds use the
  en-US build table (`WEBSITE_BUILD_BASE_PRICE`). All amounts are derived
  server-side in `src/lib/server/stripe.ts` (`computeUsdMonthlyQuote`).
- **Client:** `SubscribeSection.svelte` and `WebsiteBuildPricing.svelte`
  render the full checkout form on en-US pages and POST to
  `/api/checkout/stripe` (pt-BR keeps Mercado Pago).
- **Return page:** `/checkout/complete/` verifies `session_id` live against
  Stripe before claiming success; only `payment_status: paid` renders
  "approved" (open/processing → pending; complete-but-unpaid → truthfully
  unconfirmed). Fires the `purchase` analytics event once per session id.
- **Webhook:** `POST /api/webhooks/stripe` verifies the `stripe-signature`
  header with `STRIPE_WEBHOOK_SECRET` (signed payload `<ts>.<body>`,
  HMAC-SHA256, 5-minute recency) and emails the owner on
  `checkout.session.completed` with `payment_status: paid`. Redeliveries are
  deduped in memory by event id.

## Environment variables (Coolify → Environment Variables)

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Server-side API key (`sk_live_...` in prod, `sk_test_...` in test). Missing → the checkout endpoint returns 503 `missing_credentials` and en-US forms show "Payments are not configured yet". |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_...`); missing → the webhook endpoint refuses with 503. |

No publishable key is needed: the site never embeds Stripe.js — the server
creates the hosted session and the browser redirects to its URL (same pattern
as Mercado Pago).

## Stripe setup

1. Create the Stripe account and get the **Secret key** (Dashboard →
   Developers → API keys). Set `STRIPE_SECRET_KEY` on Coolify.
2. Create a webhook endpoint in the Stripe Dashboard → Developers → Webhooks:
   URL `https://<site>/api/webhooks/stripe`, event
   `checkout.session.completed`. Copy the signing secret into
   `STRIPE_WEBHOOK_SECRET`.
3. The USD prices live in the catalog/website-builds tables — update the
   tables (and their display copy) to change prices; the server never reads a
   browser amount.

## Money hygiene

- Amounts are integer cents at the Stripe boundary (`unit_amount =
  round(amountUSD × 100)`); no float drift reaches the API.
- BRL stays authoritative for pt-BR; USD derivations are the 5:1 reference or
  explicit USD tables — the same numbers the en-US display shows, so what the
  customer sees is what Stripe bills.
- `idempotencyKey` (UUID, reused per unchanged payload) maps to Stripe's
  `Idempotency-Key` header, deduping double-submits.

## Testing

`npm run test` covers: USD quote derivation (fixed/ads/floor/invalid), session
creation (form body, recurring vs one-time, URL validation, error mapping),
the endpoint (validation, 503 missing creds, upstream status mapping, rate
limit), the return page (paid/pending/unconfirmed/missing/error/rate-limit),
and the webhook (signature, paid → owner email, dedupe, ignored types). All
Stripe calls are mocked — no real API requests.
