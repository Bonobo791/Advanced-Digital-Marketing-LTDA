# Opt-in Contact Form (double opt-in via MailJet)

The contact form at `/contact/` (EN) and `/pt-br/contato/` (PT-BR) collects
**name + email** with an **explicit opt-in checkbox** and verifies the email
address before the request reaches the owner — a double opt-in (DOI) flow.
Every contact/quote CTA on the site (nav, footer, home hero/service/audit/
people sections, about, service pages, subscribe and website-build panels)
points to the contact form page; the form is the single contact channel.

```text
Visitor submits name + email + consent box on /contact/
    ↓  POST /api/contact/submit
Server validates (name, email, consent === true) + rate-limits per IP
    ↓
Server signs a stateless HMAC token (72h) and sends a verification email
    ↓  POST https://api.mailjet.com/v3.1/send
Visitor clicks the link in their inbox
    ↓  GET /contact/verify/?token=…  (or /pt-br/contato/verificar/?token=…)
Server verifies the token signature + expiry
    ↓
Owner is emailed the verified contact (name, email, consent timestamp)
```

Design principle (same as Mercado Pago checkout):

```text
Our website:   name + email + explicit opt-in
Our server:    validate + sign token + send via MailJet
MailJet:       transactional delivery of the verification + owner emails
No local DB:   the token is self-contained (signed payload), so nothing is
               stored server-side; MailJet is the mail system of record
```

---

## Architecture

- **Stack:** SvelteKit 2 / Svelte 5 (runes), adapter-netlify. Pages are
  prerendered; the form endpoint runs as a Netlify Function; the verify pages
  are server-rendered (`prerender = false`) because they read `?token=` at
  request time.
- **Token:** `src/lib/server/contact-token.ts` — versioned JSON payload
  (email, name, locale, `iat`, `exp`) signed with HMAC-SHA256 using
  `CONTACT_FORM_TOKEN_SECRET`. Verified with a timing-safe compare; expires
  after **72 hours**. No storage, no database.
- **MailJet client:** `src/lib/server/mailjet.ts` — all MailJet API access is
  isolated here. Send API v3.1 (`POST /v3.1/send`) with HTTP Basic auth
  (API key : API secret). Supports MailJet **sandbox mode** (root-level
  `SandboxMode: true` — payload validation without delivery) via
  `MAILJET_SANDBOX_MODE=true`.
- **Flow:** `src/lib/server/contact.ts` — `submitContactRequest` issues the
  token and sends the localized verification email; `verifyContactRequest`
  validates the token, dedupes replays (in-memory, best-effort per serverless
  instance, like the rate limiter) and emails the owner the verified contact.
- **Endpoints:** `src/routes/api/contact/submit/+server.ts` (POST) and the
  two verify pages `src/routes/contact/verify/` +
  `src/routes/pt-br/contato/verificar/`.
- **UI:** `src/lib/components/pages/ContactForm.svelte` (mounted on
  `ContactPage.svelte`) and `ContactVerifyPage.svelte` (verified / invalid /
  expired states).

### Why MailJet's Send API v3.1 and not templates

The verification email is a single, well-defined transactional message, so it
uses inline `TextPart` + `HTMLPart` — no MailJet template to create and
version in the dashboard. `SandboxMode` is a **payload root property**
(sibling of `Messages`), which the client sets from `MAILJET_SANDBOX_MODE`.

### Error contract

The submit endpoint returns stable machine-readable codes; the raw MailJet
body is only logged server-side (sanitized/truncated):

| Code | HTTP | Meaning |
|---|---|---|
| `invalid_json` | 400 | Body is not a JSON object |
| `invalid_name` | 400 | Name missing, >100 chars, or contains control chars |
| `invalid_email` | 400 | Email fails the shared `isValidEmail` shape check |
| `consent_required` | 400 | `consent` is not exactly `true` — the opt-in box must be checked |
| `rate_limited` | 429 | Per-IP window exhausted (10/min, same limiter as checkout) |
| `client_address_unavailable` | 503 | No platform client IP; refuses loudly instead of pooling clients |
| `server_misconfigured` | 503 | `CONTACT_FORM_TOKEN_SECRET` missing |
| `missing_credentials` | 503 | MailJet API key/secret missing |
| `timeout` | 503 | MailJet did not answer in 15s |
| `unauthorized` / `sender_not_authorized` / `message_rejected` / `api_error` / `invalid_response` | 502 | MailJet auth, unvalidated sender, rejected payload, upstream errors |

`sender_not_authorized` (MailJet HTTP 403 `send-0008`) means the From address
is not a **validated sender** in the MailJet account — see setup below.

---

## Environment variables

All server-only; none are ever exposed to the browser (the client only ever
sees the error codes above). Add them to Netlify (site settings) and to
`.env.local` for local dev (the repo's `vite.config.ts` loads `.env*` into
`process.env`).

| Variable | Required | Purpose |
|---|---|---|
| `MAILJET_API_KEY` | yes (to send) | MailJet API key (public) |
| `MAILJET_API_SECRET` | yes (to send) | MailJet secret key (private) — Basic auth pair |
| `MAILJET_SENDER_EMAIL` | recommended | From address; **must be validated in MailJet** (Settings → Sender domains & addresses, or API). Falls back to the site's public contact address with a loud server log if unset |
| `MAILJET_SENDER_NAME` | no | From display name (default `Advanced Digital Marketing`) |
| `CONTACT_FORM_TOKEN_SECRET` | yes | HMAC secret for verification tokens — use a long random string (e.g. `openssl rand -hex 32`). Without it the endpoint refuses with 503 `server_misconfigured` |
| `CONTACT_FORM_OWNER_EMAIL` | recommended | Inbox that receives verified contacts. Falls back to the site's public contact address with a loud server log if unset |
| `MAILJET_SANDBOX_MODE` | no | `true` validates payloads without delivering (MailJet root `SandboxMode`) — great for local testing |
| `PUBLIC_SITE_URL` | no | Public HTTPS origin used for the verification link. Falls back to the canonical domain with a loud server log (shared helper `publicSiteOrigin()` in `src/lib/server/site-url.ts`) |

### MailJet sender setup (one-time)

1. Sign in at [app.mailjet.com](https://app.mailjet.com).
2. **Account settings → Sender domains & addresses** — add and validate the
   sender domain (DNS records) and/or the sender address you put in
   `MAILJET_SENDER_EMAIL`.
3. Create an API key (Settings → API key management) with *Email sending*
   permission; copy the API key and secret key into the env vars above.
4. Until the sender is validated, submits return 502
   `sender_not_authorized` (MailJet `send-0008`).

### Local testing without sending real mail

Set `MAILJET_SANDBOX_MODE=true` with real-looking credentials — MailJet
validates the payload and returns `Status: "success"` but never delivers.
Combined with `CONTACT_FORM_TOKEN_SECRET` set locally, the full submit →
verify round trip works without any mail leaving the account.

---

## Security notes

- The consent checkbox is the legal basis for the contact: the server rejects
  anything that is not exactly boolean `true`, and the owner notification
  records the consent timestamp.
- Tokens are signed, expiring (72h), and compared timing-safely. The verify
  pages are `noindex`.
- Submission is rate-limited per client IP before any paid MailJet call.
- Name input is capped at 100 chars and stripped of control characters before
  it can reach email copy or logs.
- Verification links use `publicSiteOrigin()` so a misconfigured
  `PUBLIC_SITE_URL` can never produce an http:// or loopback link.
