/**
 * MailJet client (opt-in contact form).
 *
 * All MailJet API access lives here — routes and server modules call this
 * abstraction instead of talking to `api.mailjet.com` directly.
 *
 * The opt-in contact form uses the Send API v3.1 (`POST /v3.1/send`) for two
 * kinds of transactional mail: the verification email that goes to the
 * visitor (double opt-in) and the owner notification sent after the address
 * is verified. Credentials are HTTP Basic (API key : API secret); the sender
 * must be a validated sender in the MailJet account (the API returns HTTP 403
 * `send-0008` otherwise).
 *
 * Sandbox mode: MailJet validates the payload without delivering when the
 * root-level `SandboxMode` property is `true` (it is a payload ROOT property,
 * not a per-message one). `MAILJET_SANDBOX_MODE=true` enables it — useful for
 * local testing with real-looking payloads and zero outbound mail.
 *
 * Server-only: reads `MAILJET_API_KEY`, `MAILJET_API_SECRET`,
 * `MAILJET_SENDER_EMAIL`, `MAILJET_SENDER_NAME` and `MAILJET_SANDBOX_MODE`
 * from the environment. Credentials never leave this module.
 */
import { EMAIL } from '$lib/constants'

export const MAILJET_SEND_ENDPOINT = 'https://api.mailjet.com/v3.1/send'
/**
 * Time budget for a single MailJet API call. The browser-side contact-form
 * timer must stay comfortably longer than this (guarded by a unit test in
 * the same way the checkout timers are).
 */
export const MAILJET_REQUEST_TIMEOUT_MS = 15_000

export type MailjetErrorCode =
  | 'missing_credentials'
  | 'unauthorized'
  | 'sender_not_authorized'
  | 'message_rejected'
  | 'api_error'
  | 'timeout'
  | 'invalid_response'
  | 'sandbox_in_production'

export class MailjetError extends Error {
  code: MailjetErrorCode

  constructor(code: MailjetErrorCode, message: string) {
    super(message)
    this.name = 'MailjetError'
    this.code = code
  }
}

export type MailjetMessageInput = {
  toEmail: string
  toName: string
  subject: string
  textPart: string
  /** Optional HTML body; at least one of textPart/htmlPart is required. */
  htmlPart?: string
  /** Optional Reply-To address (e.g. the verified lead's inbox for owner notifications). */
  replyToEmail?: string
}

export type MailjetMessageResult = {
  /** MailJet message id (from the send response `Messages[].To[].MessageID`). */
  messageId: string | undefined
}

function readCredentials(): { apiKey?: string; apiSecret?: string } {
  return {
    apiKey: process.env.MAILJET_API_KEY?.trim() || undefined,
    apiSecret: process.env.MAILJET_API_SECRET?.trim() || undefined,
  }
}

/**
 * The validated MailJet sender address. `MAILJET_SENDER_EMAIL` wins; without
 * it the site's public contact address is used — a documented default, logged
 * loudly so a misconfiguration is never silent.
 */
export function mailjetSenderEmail(): string {
  const configured = process.env.MAILJET_SENDER_EMAIL?.trim()
  if (configured) return configured
  console.error('[mailjet] MAILJET_SENDER_EMAIL is not set; using the site contact address as the sender')
  return EMAIL
}

/** Display name for the sender; defaults to the brand. */
export function mailjetSenderName(): string {
  return process.env.MAILJET_SENDER_NAME?.trim() || 'Advanced Digital Marketing'
}

/** True when sandbox mode is enabled (payload validation without delivery). */
export function mailjetSandboxMode(): boolean {
  return process.env.MAILJET_SANDBOX_MODE?.trim() === 'true'
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'TimeoutError') return true
  const cause = error instanceof Error ? (error as { cause?: unknown }).cause : undefined
  return cause instanceof Error && cause.name === 'TimeoutError'
}

/**
 * One sanitization pipeline for every MailJet log line: strip control
 * characters/newlines (log forging, terminal escape injection), collapse
 * whitespace, and cap the preview. Single definition for both log sites
 * (AGENTS.md: DO create reusable code).
 */
function sanitizeForLog(value: string): string {
  const cleaned = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim()
  if (cleaned.length <= 2000) return cleaned
  const preview = cleaned.slice(0, 2000)
  return `${preview}…(truncated ${value.length} bytes)`
}

/**
 * Replaces email-like tokens before logging. MailJet echoes the rejected
 * recipient address in send-error bodies; the visitor's address must never
 * land in server logs, so logs carry the classification fields plus a
 * redacted preview.
 */
function redactEmails(value: string): string {
  // Single-pass scan, O(n) — the regex equivalent is super-linear and
  // rejected by the analyzer (SonarCloud: S8786). Locate each '@', extend to
  // the surrounding email characters (local part: word chars + . _ % + -;
  // domain: word chars + . -), and replace the span. Over-redaction (e.g. a
  // trailing sentence period) is safe: logs must never carry addresses.
  const isEmailChar = (ch: string): boolean => /[A-Za-z0-9._%+-]/.test(ch)
  let out = ''
  let cursor = 0
  while (cursor < value.length) {
    const at = value.indexOf('@', cursor)
    if (at === -1) {
      out += value.slice(cursor)
      break
    }
    let start = at
    while (start > cursor && isEmailChar(value[start - 1])) start -= 1
    let end = at + 1
    while (end < value.length && isEmailChar(value[end])) end += 1
    out += value.slice(cursor, start)
    out += start < at ? '[email redacted]' : '@'
    cursor = end
  }
  return out
}

/**
 * Reads the MailJet error body once and returns its `ErrorCode` (e.g.
 * "mj-0001", "send-0008") when parseable — used to tell an unvalidated sender
 * apart from a generic credential problem.
 */
/** Extracts MailJet's classification ErrorCode from a response body (string only). */
function parseErrorCode(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as { ErrorCode?: unknown }
    return typeof parsed.ErrorCode === 'string' ? parsed.ErrorCode : undefined
  } catch {
    // Body is not JSON — the status code still tells us what failed.
    return undefined
  }
}

async function readMailjetErrorCode(response: Response): Promise<string | undefined> {
  const body = await response.text().catch(() => '')
  const code = parseErrorCode(body)
  // Log the classification code plus a sanitized, recipient-redacted preview;
  // never the raw body (MailJet echoes the recipient address in send errors).
  const codeLabel = code ? ` code=${code}` : ''
  console.error(`[mailjet] error (HTTP ${response.status})${codeLabel}: ${redactEmails(sanitizeForLog(body))}`)
  return code
}

/**
 * Classifies a 4xx auth/sender failure. HTTP 401 is the API key (suspended or
 * invalid). HTTP 403 with `send-0006`/`send-0007`/`send-0008` means the From
 * address is not a validated sender in the MailJet account — a configuration
 * problem the operator must fix, not a retryable outage.
 */
function classifyAuthFailure(status: number, errorCode: string | undefined): MailjetErrorCode {
  if (status === 401) return 'unauthorized'
  if (status === 403 && errorCode && /^send-000[678]$/.test(errorCode)) return 'sender_not_authorized'
  return 'unauthorized'
}

/**
 * Fetches the Send API with the configured timeout and classifies transport
 * failures (timeouts vs everything else) into `MailjetError` codes.
 */
async function sendRequest(input: MailjetMessageInput, apiKey: string, apiSecret: string): Promise<Response> {
  const body = {
    Messages: [
      {
        From: { Email: mailjetSenderEmail(), Name: mailjetSenderName() },
        To: [{ Email: input.toEmail, Name: input.toName }],
        Subject: input.subject,
        TextPart: input.textPart,
        // Omit the HTML part entirely when none was provided (an empty string
        // would be a payload the Send API may reject).
        ...(input.htmlPart ? { HTMLPart: input.htmlPart } : {}),
        // Reply-To routes the recipient's Reply action to this address
        // (e.g. the verified lead's inbox) instead of the sender inbox.
        // MailJet v3.1 expects a single contact OBJECT here (unlike the
        // array-valued To/Cc/Bcc) — an array would make the API reject the
        // message.
        ...(input.replyToEmail ? { ReplyTo: { Email: input.replyToEmail } } : {}),
      },
    ],
    // Root-level property (sibling of Messages): MailJet validates the payload
    // without delivering when enabled.
    ...(mailjetSandboxMode() ? { SandboxMode: true } : {}),
  }
  const apiCredentials = `${apiKey}:${apiSecret}`
  try {
    return await fetch(MAILJET_SEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(apiCredentials).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(MAILJET_REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new MailjetError('timeout', 'MailJet request timed out')
    }
    throw new MailjetError('api_error', 'MailJet request failed')
  }
}

/** Classifies a 401/403 auth/sender failure into the stable error for callers. */
async function authFailure(response: Response): Promise<MailjetError> {
  const errorCode = await readMailjetErrorCode(response)
  const code = classifyAuthFailure(response.status, errorCode)
  return new MailjetError(
    code,
    code === 'sender_not_authorized' ? 'MailJet sender is not validated' : 'MailJet rejected the API credentials',
  )
}

/**
 * Parses the send response and returns the single message record, throwing a
 * stable `MailjetError` when the payload is malformed or the message was
 * rejected. A 200 with `Status: "error"` is a rejected message, not success.
 */
async function readSendMessage(response: Response): Promise<Record<string, unknown>> {
  let parsed: unknown
  try {
    parsed = await response.json()
  } catch {
    throw new MailjetError('invalid_response', 'MailJet returned malformed JSON')
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new MailjetError('invalid_response', 'MailJet returned malformed JSON')
  }

  const record = parsed as Record<string, unknown>
  const messages = Array.isArray(record.Messages) ? (record.Messages as Record<string, unknown>[]) : []
  const message = messages[0]
  if (message?.Status !== 'success') rejectMessage(message)
  return message
}

/**
 * Extracts the non-sensitive classification fields from one rejected-message
 * Errors entry (ErrorCode / StatusCode / ErrorIdentifier). The free-text
 * fields are dropped because they can echo the recipient address.
 */
function classifiedErrorOf(entry: Record<string, unknown>): string | undefined {
  const code = typeof entry.ErrorCode === 'string' ? entry.ErrorCode : undefined
  const status = typeof entry.StatusCode === 'string' ? entry.StatusCode : undefined
  const identifier = typeof entry.ErrorIdentifier === 'string' ? entry.ErrorIdentifier : undefined
  const parts = [code, status, identifier].filter((part): part is string => part !== undefined)
  return parts.length > 0 ? parts.join(' ') : undefined
}

/** Logs a rejected-message payload (classification fields only) and throws. */
function rejectMessage(message: Record<string, unknown> | undefined): never {
  // HTTP 200 with a per-message error Status: log only ErrorCode /
  // StatusCode / ErrorIdentifier — never the free-text Errors entries, which
  // can echo the recipient address.
  const classified = (Array.isArray(message?.Errors) ? (message.Errors as Record<string, unknown>[]) : [])
    .map(classifiedErrorOf)
    .filter((part): part is string => part !== undefined)
    .join('; ')
  const classifiedLabel = classified ? `: ${classified}` : ''
  console.error(`[mailjet] message_rejected${classifiedLabel}`)
  throw new MailjetError('message_rejected', 'MailJet rejected the message payload')
}

/**
 * MailJet does not return the message id on the send response object itself;
 * when present it lives on To[].MessageID (an integer in the API reference).
 * Normalized to a string so callers get one stable type.
 */
function messageIdOf(message: Record<string, unknown>): string | undefined {
  const to = Array.isArray(message.To) ? (message.To as Record<string, unknown>[]) : []
  const rawId = to[0]?.MessageID
  if (typeof rawId === 'string') return rawId
  if (typeof rawId === 'number') return String(rawId)
  return undefined
}

/**
 * Sends one transactional message through MailJet Send API v3.1.
 *
 * Throws `MailjetError` with a machine-readable code on every failure;
 * success requires HTTP 200 AND `Status: "success"` on the (single) message —
 * a 200 response with `Status: "error"` is a rejected message, not a success.
 * The raw HTTP body is never surfaced to callers.
 */
export async function sendMailjetMessage(input: MailjetMessageInput): Promise<MailjetMessageResult> {
  const { apiKey, apiSecret } = readCredentials()
  if (!apiKey || !apiSecret) {
    throw new MailjetError('missing_credentials', 'MailJet API credentials are not configured')
  }
  if (mailjetSandboxMode() && process.env.NODE_ENV === 'production') {
    // Sandbox mode validates payloads WITHOUT delivering; left on in
    // production it would silently report success while sending nothing
    // (AGENTS.md: no silent fallbacks). Refuse loudly so the operator sees
    // the misconfiguration and the visitor gets the honest error state.
    console.error(
      '[mailjet] MAILJET_SANDBOX_MODE=true is set in production — messages would be validation-only; refusing to send',
    )
    throw new MailjetError('sandbox_in_production', 'MailJet sandbox mode is enabled in production')
  }

  const response = await sendRequest(input, apiKey, apiSecret)
  if (response.status === 401 || response.status === 403) {
    throw await authFailure(response)
  }
  if (!response.ok) {
    await readMailjetErrorCode(response)
    throw new MailjetError('api_error', `MailJet returned HTTP ${response.status}`)
  }

  const message = await readSendMessage(response)
  return { messageId: messageIdOf(message) }
}
