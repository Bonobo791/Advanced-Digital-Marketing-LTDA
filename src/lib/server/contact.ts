/**
 * Opt-in contact form flow (double opt-in).
 *
 *   1. Visitor submits name + email + explicit consent on /contact/.
 *   2. The server signs a stateless token (see contact-token.ts) and sends a
 *      verification email through MailJet (see mailjet.ts) with a link back to
 *      the localized verify page.
 *   3. Clicking the link verifies the token; the verified contact (name, email,
 *      consent timestamp) is then emailed to the owner so the lead lands in the
 *      same inbox the site's mailto/WhatsApp channels used before.
 *
 * There is no local database: the token is the only state, and MailJet is the
 * mail system of record — matching how Mercado Pago owns all checkout state.
 *
 * Failure philosophy (AGENTS.md): every misconfiguration fails loud on the
 * server log with a stable error code for the caller. The one deliberate
 * exception is the owner notification inside `verifyContactRequest`: the
 * visitor already proved their address, so a notification failure must not
 * turn a valid verification into an error page — it is logged loudly instead.
 */
import { createHash } from 'node:crypto'
import { EMAIL } from '$lib/constants'
import type { Locale } from '$lib/locale'
import { CONTACT_TOKEN_TTL_SECONDS, createContactToken, verifyContactToken, type ContactTokenResult } from './contact-token.ts'
import { MailjetError, sendMailjetMessage } from './mailjet.ts'
import { publicSiteOrigin } from './site-url.ts'

/**
 * HTML-escapes visitor-controlled text (the name) before it is interpolated
 * into the HTML email — mail clients do not run scripts, but injected markup
 * would still render and could be used for phishing.
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** Localized verify-page routes (one per locale, mirroring LOCALE_ROUTES). */
export const CONTACT_VERIFY_ROUTES: Record<Locale, string> = {
  'en-US': '/contact/verify/',
  'pt-BR': '/pt-br/contato/verificar/',
}

export type ContactSubmitInput = {
  name: string
  email: string
  locale: Locale
}

export type ContactSubmitResult = {
  /** How long the verification link stays valid (for the "check your inbox" copy). */
  expiresInHours: number
}

export type ContactVerifyResult =
  | { status: 'verified'; name: string; email: string }
  | { status: 'invalid' }
  | { status: 'expired' }

/** Full verification URL for the localized route (public HTTPS origin). */
export function contactVerificationUrl(token: string, locale: Locale): string {
  return new URL(CONTACT_VERIFY_ROUTES[locale], publicSiteOrigin()).toString() + `?token=${encodeURIComponent(token)}`
}

/**
 * The inbox that receives verified-contact notifications.
 * `CONTACT_FORM_OWNER_EMAIL` wins; the site's public contact address is the
 * documented default, logged loudly when the fallback is taken.
 */
export function contactOwnerEmail(): string {
  const configured = process.env.CONTACT_FORM_OWNER_EMAIL?.trim()
  if (configured) return configured
  console.error('[contact] CONTACT_FORM_OWNER_EMAIL is not set; using the site contact address as the owner inbox')
  return EMAIL
}

/* ─── Verification email copy (localized) ─────────────────────────────── */

function verificationSubject(locale: Locale): string {
  return locale === 'pt-BR'
    ? 'Confirme sua solicitação de contato — Advanced Digital Marketing'
    : 'Confirm your contact request — Advanced Digital Marketing'
}

function verificationText(name: string, url: string, locale: Locale): string {
  return locale === 'pt-BR'
    ? `Olá ${name},

Você solicitou que a Advanced Digital Marketing entrasse em contato. Para confirmar seu endereço de e-mail e concluir sua solicitação, abra o link abaixo:

${url}

Este link expira em 72 horas. Se você não fez esta solicitação, basta ignorar este e-mail — nada mais acontecerá.

— Advanced Digital Marketing LTDA
São Paulo · advanceddigitalmarketingltda.com`
    : `Hi ${name},

You asked Advanced Digital Marketing to get in touch. To confirm your email address and complete your request, open the link below:

${url}

This link expires in 72 hours. If you did not submit this request, you can simply ignore this email — nothing else will happen.

— Advanced Digital Marketing LTDA
São Paulo · advanceddigitalmarketingltda.com`
}

function verificationHtml(name: string, url: string, locale: Locale): string {
  const heading = locale === 'pt-BR' ? 'Confirme seu e-mail' : 'Confirm your email'
  const lead =
    locale === 'pt-BR'
      ? `Olá ${escapeHtml(name)}, você solicitou que a Advanced Digital Marketing entrasse em contato. Confirme seu endereço de e-mail para concluir sua solicitação.`
      : `Hi ${escapeHtml(name)}, you asked Advanced Digital Marketing to get in touch. Confirm your email address to complete your request.`
  const cta = locale === 'pt-BR' ? 'Confirmar e-mail' : 'Confirm email'
  const expires =
    locale === 'pt-BR'
      ? 'Este link expira em 72 horas. Se você não fez esta solicitação, ignore este e-mail.'
      : 'This link expires in 72 hours. If you did not submit this request, ignore this email.'
  const base = publicSiteOrigin()
  return `<!doctype html><html lang="${locale === 'pt-BR' ? 'pt-BR' : 'en'}"><body style="margin:0;padding:0;background:#121212">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#121212"><tr><td align="center" style="padding:48px 16px">
    <table role="presentation" width="100%" style="max-width:560px;background:#f2efe9;border:1px solid #e5e0d6;font-family:Helvetica,Arial,sans-serif">
      <tr><td style="padding:32px 36px">
        <p style="margin:0 0 24px;color:#e83828;font-size:12px;letter-spacing:0.14em;text-transform:uppercase">ADVANCED DIGITAL MARKETING</p>
        <h1 style="margin:0 0 16px;color:#121212;font-size:24px;line-height:1.2">${heading}</h1>
        <p style="margin:0 0 28px;color:#3d3d3d;font-size:15px;line-height:1.6">${lead}</p>
        <p style="margin:0 0 28px"><a href="${url}" style="display:inline-block;background:#e83828;color:#f2efe9;text-decoration:none;padding:14px 28px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase">${cta}</a></p>
        <p style="margin:0;color:#6b6b6b;font-size:13px;line-height:1.6">${expires}</p>
        <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #e5e0d6;color:#6b6b6b;font-size:12px;line-height:1.6">Advanced Digital Marketing LTDA · São Paulo, Brasil<br /><a href="${base}" style="color:#e83828;text-decoration:none">advanceddigitalmarketingltda.com</a></p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`
}

/* ─── Owner notification copy (localized) ─────────────────────────────── */

function ownerNotificationSubject(name: string, email: string, locale: Locale): string {
  return locale === 'pt-BR'
    ? `Novo contato verificado: ${name} <${email}>`
    : `New verified contact: ${name} <${email}>`
}

function ownerNotificationText(name: string, email: string, issuedAt: number, locale: Locale): string {
  const when = new Date(issuedAt * 1000).toISOString()
  const consent =
    locale === 'pt-BR'
      ? 'consentimento explícito de contato registrado'
      : 'explicit contact consent recorded'
  const next =
    locale === 'pt-BR'
      ? 'Responda a este contato pelo e-mail acima em até um dia útil.'
      : 'Reply to this contact at the address above within one business day.'
  return `Name: ${name}
Email: ${email}
${consent} at: ${when} (UTC)
Locale: ${locale}

${next}

— advanceddigitalmarketingltda.com/contact`
}

/* ─── Flow entry points ───────────────────────────────────────────────── */

/**
 * Validates nothing itself — the endpoint validates before calling — but
 * signs the token and sends the verification email. Throws `ContactTokenError`
 * or `MailjetError`; callers map codes to HTTP statuses.
 */
export async function submitContactRequest(input: ContactSubmitInput): Promise<ContactSubmitResult> {
  const { token } = createContactToken(input)
  const url = contactVerificationUrl(token, input.locale)
  await sendMailjetMessage({
    toEmail: input.email,
    toName: input.name,
    subject: verificationSubject(input.locale),
    textPart: verificationText(input.name, url, input.locale),
    htmlPart: verificationHtml(input.name, url, input.locale),
  })
  return { expiresInHours: CONTACT_TOKEN_TTL_SECONDS / 3600 }
}

/**
 * Best-effort dedupe for owner notifications, keyed by token hash.
 *
 * The verification link is stateless and therefore inherently replayable; a
 * double click (or a resent link) would otherwise email the owner twice for
 * the same consent. This map remembers processed token hashes for the token's
 * lifetime and skips the notification on replays. Like the in-memory rate
 * limiter, it is per-serverless-instance — documented as best-effort, not a
 * hard guarantee — and is size-capped so it can never grow without bound.
 */
const processedVerifications = new Map<string, number>()

const MAX_PROCESSED_VERIFICATIONS = 10_000

function markProcessed(token: string, expiresAtMs: number, now: number): boolean {
  // Purge entries whose tokens have already expired — they can never replay.
  for (const [hash, expires] of processedVerifications) {
    if (expires <= now) processedVerifications.delete(hash)
  }
  const hash = createHash('sha256').update(token).digest('hex')
  if (processedVerifications.has(hash)) return false
  if (processedVerifications.size >= MAX_PROCESSED_VERIFICATIONS) {
    // Map preserves insertion order: drop the oldest entry.
    const oldest = processedVerifications.keys().next()
    if (!oldest.done) processedVerifications.delete(oldest.value)
  }
  processedVerifications.set(hash, expiresAtMs)
  return true
}

/** Test hook: clears processed-token state. Never called from production paths. */
export function resetProcessedVerifications(): void {
  processedVerifications.clear()
}

/** Test hook: number of tracked tokens. Never called from production paths. */
export function processedVerificationCount(): number {
  return processedVerifications.size
}

/**
 * Verifies a submission token and, on first use, emails the owner the
 * verified contact details. Returns the page state for the verify page.
 * `now` is injectable for tests.
 */
export async function verifyContactRequest(token: string, now: number = Date.now()): Promise<ContactVerifyResult> {
  const result: ContactTokenResult = verifyContactToken(token, now)
  if (result.status !== 'verified') {
    return result.status === 'expired' ? { status: 'expired' } : { status: 'invalid' }
  }
  const { name, email, locale, issuedAt, expiresAt } = result.payload

  if (markProcessed(token, expiresAt * 1000, now)) {
    try {
      await sendMailjetMessage({
        toEmail: contactOwnerEmail(),
        toName: 'Advanced Digital Marketing',
        subject: ownerNotificationSubject(name, email, locale),
        textPart: ownerNotificationText(name, email, issuedAt, locale),
      })
    } catch (error) {
      // The address is verified; only the notification failed. Fail loud on
      // the server log, never turn the visitor's valid link into an error.
      if (error instanceof MailjetError) {
        console.error(`[contact] owner notification failed after verification: ${error.code}`)
      } else {
        console.error('[contact] owner notification failed after verification', error)
      }
    }
  }
  return { status: 'verified', name, email }
}
