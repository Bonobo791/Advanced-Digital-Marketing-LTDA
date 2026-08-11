/**
 * Mercado Pago subscriptions client (spec §9, §14).
 *
 * All Mercado Pago API access lives here — pages and routes call this
 * abstraction instead of talking to `api.mercadopago.com` directly.
 *
 * Flow: create a subscription WITHOUT an associated plan via
 * `POST /preapproval` with `status: "pending"` (hosted-checkout, pending
 * payment model). Mercado Pago stores the subscription and returns an
 * `init_point` URL that the browser is redirected to; billing, pausing,
 * cancelling and payment history all stay in Mercado Pago.
 *
 * Server-only: reads `MERCADO_PAGO_ACCESS_TOKEN` / `MERCADO_PAGO_SANDBOX_ACCESS_TOKEN`
 * from the environment. The access token never leaves this module.
 */
import { isSandboxAccessToken } from './sandbox.ts'

export const PREAPPROVAL_ENDPOINT = 'https://api.mercadopago.com/preapproval'
/**
 * Time budget for a single Mercado Pago API call.
 *
 * The client-side checkout timer in `SubscribeSection.svelte` must stay
 * comfortably longer than this: the browser clock starts when the fetch is
 * issued and therefore also covers browser→function latency and server
 * processing, so an equal or shorter client timeout could abort right as the
 * server returns the checkout URL. Guarded by `checkout-timeouts.unit.test.ts`.
 */
export const REQUEST_TIMEOUT_MS = 15_000

export type CreateSubscriptionInput = {
  email: string
  reason: string
  externalReference: string
  /** Monthly amount in BRL — always the server-computed total. */
  amountBRL: number
  backUrl: string
  idempotencyKey: string
}

export type SubscriptionCreated = {
  id: string
  checkoutUrl: string
}

export type MercadoPagoErrorCode =
  | 'missing_credentials'
  | 'unauthorized'
  | 'api_error'
  | 'timeout'
  | 'invalid_response'
  | 'missing_init_point'
  | 'invalid_init_point'

export class MercadoPagoError extends Error {
  code: MercadoPagoErrorCode

  constructor(code: MercadoPagoErrorCode, message: string) {
    super(message)
    this.name = 'MercadoPagoError'
    this.code = code
  }
}

/** Hosts the hosted subscription checkout may legitimately live on. */
export function isAllowedCheckoutUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  const host = url.hostname.toLowerCase()
  return (
    host === 'mercadopago.com' ||
    host.endsWith('.mercadopago.com') ||
    host === 'mercadopago.com.br' ||
    host.endsWith('.mercadopago.com.br')
  )
}

/**
 * Picks the redirect URL from the create-subscription response.
 *
 * The Subscriptions API (`POST /preapproval`) returns a single checkout link
 * in `init_point` regardless of environment — sandbox mode is determined by
 * the credential used (TEST vs APP_USR), and the checkout page resolves the
 * environment from the preapproval itself. Unlike the removed Checkout Pro
 * client, there is no `sandbox_init_point` field here.
 *
 * Preference: `sandbox_init_point` when present (defensive, in case another
 * API shape ever returns both), otherwise `init_point`. A response with
 * NEITHER field returns `undefined` and becomes `missing_init_point` — but a
 * response that omits `init_point` while carrying only a sandbox URL is still
 * rejected in production mode, so a real customer is never sent to the
 * sandbox.
 */
export function selectInitPoint(
  response: { init_point?: string; sandbox_init_point?: string },
  accessToken: string | undefined,
  sandboxToken: string | undefined,
): string | undefined {
  if (isSandboxAccessToken(accessToken, sandboxToken) && response.sandbox_init_point) {
    return response.sandbox_init_point
  }
  return response.init_point
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'TimeoutError') return true
  const cause = error instanceof Error ? (error as { cause?: unknown }).cause : undefined
  return cause instanceof Error && cause.name === 'TimeoutError'
}

function readCredentials(): { accessToken?: string; sandboxToken?: string } {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim()
  const sandboxToken = process.env.MERCADO_PAGO_SANDBOX_ACCESS_TOKEN?.trim()
  return {
    accessToken: accessToken || undefined,
    sandboxToken: sandboxToken || undefined,
  }
}

/**
 * Logs the Mercado Pago error response body server-side so real failures are
 * diagnosable (e.g. "Subscriptions not enabled", invalid payer_email, bad
 * back_url). The body is truncated and the raw text is never returned to
 * callers — the client contract stays a stable error code.
 */
async function logMercadoPagoError(response: Response, code: MercadoPagoError['code']): Promise<void> {
  const body = await response.text().catch(() => '')
  // MP error bodies can echo customer-controlled input (email, reason,
  // back_url) — strip control chars/newlines to prevent log forging and
  // terminal escape injection, then collapse whitespace.
  const sanitized = body
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const preview =
    sanitized.length > 2000 ? `${sanitized.slice(0, 2000)}…(truncated ${body.length} bytes)` : sanitized
  console.error(`[mercadoPago] ${code} (HTTP ${response.status}): ${preview}`)
}

/**
 * Creates a Mercado Pago subscription (no associated plan) and returns the
 * hosted checkout URL. Throws `MercadoPagoError` with a machine-readable code;
 * the raw HTTP body is never surfaced to callers.
 */
export async function createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionCreated> {
  const { accessToken, sandboxToken } = readCredentials()
  if (!accessToken) {
    throw new MercadoPagoError('missing_credentials', 'Mercado Pago access token is not configured')
  }

  let response: Response
  try {
    response = await fetch(PREAPPROVAL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        reason: input.reason,
        external_reference: input.externalReference,
        payer_email: input.email,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: input.amountBRL,
          currency_id: 'BRL',
        },
        back_url: input.backUrl,
        status: 'pending',
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new MercadoPagoError('timeout', 'Mercado Pago request timed out')
    }
    throw new MercadoPagoError('api_error', 'Mercado Pago request failed')
  }

  if (response.status === 401 || response.status === 403) {
    await logMercadoPagoError(response, 'unauthorized')
    throw new MercadoPagoError('unauthorized', 'Mercado Pago rejected the access token')
  }
  if (!response.ok) {
    await logMercadoPagoError(response, 'api_error')
    throw new MercadoPagoError('api_error', `Mercado Pago returned HTTP ${response.status}`)
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new MercadoPagoError('invalid_response', 'Mercado Pago returned malformed JSON')
  }

  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  const id = typeof record.id === 'string' && record.id ? record.id : undefined
  const initPoint = selectInitPoint(record, accessToken, sandboxToken)

  if (!id) {
    throw new MercadoPagoError('invalid_response', 'Mercado Pago response is missing id')
  }
  if (!initPoint) {
    throw new MercadoPagoError('missing_init_point', 'Mercado Pago response is missing init_point')
  }
  if (!isAllowedCheckoutUrl(initPoint)) {
    throw new MercadoPagoError('invalid_init_point', 'Mercado Pago returned an unexpected checkout URL')
  }

  return { id, checkoutUrl: initPoint }
}

export type SubscriptionStatus = {
  id: string
  status: string | null
  reason: string | null
  externalReference: string | null
  payerEmail: string | null
  transactionAmount: number | null
  currencyId: string | null
}

/**
 * Fetches a subscription directly from Mercado Pago and returns a sanitized
 * subset of its state. Returns `undefined` when credentials are missing or the
 * subscription does not exist (404). Nothing is cached or persisted locally.
 */
export async function getSubscription(subscriptionId: string): Promise<SubscriptionStatus | undefined> {
  const { accessToken } = readCredentials()
  if (!accessToken) return undefined

  let response: Response
  try {
    response = await fetch(
      `https://api.mercadopago.com/preapproval/${encodeURIComponent(subscriptionId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    )
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new MercadoPagoError('timeout', 'Mercado Pago request timed out')
    }
    throw new MercadoPagoError('api_error', 'Mercado Pago request failed')
  }

  if (response.status === 401 || response.status === 403) {
    await logMercadoPagoError(response, 'unauthorized')
    throw new MercadoPagoError('unauthorized', 'Mercado Pago rejected the access token')
  }
  if (response.status === 404) return undefined
  if (!response.ok) {
    await logMercadoPagoError(response, 'api_error')
    throw new MercadoPagoError('api_error', `Mercado Pago returned HTTP ${response.status}`)
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new MercadoPagoError('invalid_response', 'Mercado Pago returned malformed JSON')
  }

  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  if (typeof record.id !== 'string' || !record.id) {
    throw new MercadoPagoError('invalid_response', 'Mercado Pago response is missing id')
  }
  return mapSubscriptionStatus(record)
}

/**
 * Maps a sanitized subscription status from a validated Mercado Pago
 * preapproval record. Only safe, typed fields are copied — everything else in
 * the response (card ids, tokens, …) is dropped.
 */
function mapSubscriptionStatus(record: Record<string, unknown>): SubscriptionStatus {
  const recurring =
    typeof record.auto_recurring === 'object' && record.auto_recurring !== null
      ? (record.auto_recurring as Record<string, unknown>)
      : {}

  return {
    id: record.id as string,
    status: typeof record.status === 'string' ? record.status : null,
    reason: typeof record.reason === 'string' ? record.reason : null,
    externalReference: typeof record.external_reference === 'string' ? record.external_reference : null,
    payerEmail: typeof record.payer_email === 'string' ? record.payer_email : null,
    transactionAmount:
      typeof recurring.transaction_amount === 'number' ? recurring.transaction_amount : null,
    currencyId: typeof recurring.currency_id === 'string' ? recurring.currency_id : null,
  }
}
