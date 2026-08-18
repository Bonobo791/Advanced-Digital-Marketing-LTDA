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
 * Reads the MailJet error body once and returns its `ErrorCode` (e.g.
 * "mj-0001", "send-0008") when parseable — used to tell an unvalidated sender
 * apart from a generic credential problem.
 */
async function readMailjetErrorCode(response: Response): Promise<string | undefined> {
  const body = await response.text().catch(() => '')
  const sanitized = body
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const preview =
    sanitized.length > 2000 ? `${sanitized.slice(0, 2000)}…(truncated ${body.length} bytes)` : sanitized
  let code: string | undefined
  try {
    const parsed = JSON.parse(body) as { ErrorCode?: unknown }
    code = typeof parsed.ErrorCode === 'string' ? parsed.ErrorCode : undefined
  } catch {
    // Body is not JSON — the status code still tells us what failed.
  }
  console.error(`[mailjet] error (HTTP ${response.status}): ${preview}`)
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
      },
    ],
    // Root-level property (sibling of Messages): MailJet validates the payload
    // without delivering when enabled.
    ...(mailjetSandboxMode() ? { SandboxMode: true } : {}),
  }

  let response: Response
  try {
    response = await fetch(MAILJET_SEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
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

  if (response.status === 401 || response.status === 403) {
    const errorCode = await readMailjetErrorCode(response)
    const code = classifyAuthFailure(response.status, errorCode)
    throw new MailjetError(code, code === 'sender_not_authorized' ? 'MailJet sender is not validated' : 'MailJet rejected the API credentials')
  }
  if (!response.ok) {
    await readMailjetErrorCode(response)
    throw new MailjetError('api_error', `MailJet returned HTTP ${response.status}`)
  }

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
  if (!message || message.Status !== 'success') {
    // HTTP 200 with a per-message error Status: log the embedded Errors
    // array server-side, keep the stable error code for callers.
    const detail = JSON.stringify(message.Errors ?? '')
    const sanitized = detail.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim()
    console.error(`[mailjet] message_rejected: ${sanitized.slice(0, 2000)}`)
    throw new MailjetError('message_rejected', 'MailJet rejected the message payload')
  }

  // MailJet does not return the message id on the send response object
  // itself; when present it lives on To[].MessageID (an integer in the API
  // reference). Normalized to a string so callers get one stable type.
  const to = Array.isArray(message.To) ? (message.To as Record<string, unknown>[]) : []
  const rawId = to[0]?.MessageID
  const messageId = typeof rawId === 'string' ? rawId : typeof rawId === 'number' ? String(rawId) : undefined
  return { messageId }
}
