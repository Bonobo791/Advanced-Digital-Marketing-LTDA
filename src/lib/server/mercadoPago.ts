/**
 * Mercado Pago client (spec §9, §14).
 *
 * All Mercado Pago API access lives here — pages and routes call this
 * abstraction instead of talking to `api.mercadopago.com` directly.
 *
 * Two hosted-checkout flows:
 *  - Subscriptions: `POST /preapproval` with `status: "pending"` (no plan).
 *    Mercado Pago stores the subscription and returns an `init_point` the
 *    browser is redirected to; billing, pausing, cancelling and payment
 *    history all stay in Mercado Pago.
 *  - One-time payments: `POST /checkout/preferences` (Checkout Pro). The
 *    preference is charged once when the customer pays on the hosted
 *    checkout; `getPayment` verifies the resulting `payment_id` on the
 *    return page.
 *
 * Server-only: reads `MERCADO_PAGO_ACCESS_TOKEN` / `MERCADO_PAGO_SANDBOX_ACCESS_TOKEN`
 * from the environment. The access token never leaves this module.
 */
import { isSandboxAccessToken } from './sandbox.ts'

export const PREAPPROVAL_ENDPOINT = 'https://api.mercadopago.com/preapproval'
export const CHECKOUT_PRO_PREFERENCES_ENDPOINT = 'https://api.mercadopago.com/checkout/preferences'
export const PAYMENTS_ENDPOINT = 'https://api.mercadopago.com/v1/payments'
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

export type CheckoutPaymentMethods = {
  /** Mercado Pago payment-type ids to exclude, e.g. `prepaid_card`. */
  excludedPaymentTypes: readonly string[]
  /** Maximum number of installments offered to the buyer (credit card). */
  maxInstallments: number
  /** Installments preselected in the checkout — 1 means full payment (à vista). */
  defaultInstallments: number
}

export type CreateCheckoutPreferenceInput = {
  title: string
  /** One-time amount in BRL — always the server-computed build price. */
  amountBRL: number
  externalReference: string
  backUrls: { success: string; failure: string; pending: string }
  idempotencyKey: string
  /**
   * Which payment methods the hosted checkout offers (exclusions + credit
   * installments). Required on purpose: omitting it would silently fall back
   * to Checkout Pro's default "all methods" behavior (AGENTS.md: no silent
   * fallbacks).
   */
  paymentMethods: CheckoutPaymentMethods
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
 * POSTs a JSON body to a Mercado Pago endpoint with the access token and
 * idempotency key, and returns the parsed JSON record. Every HTTP/network
 * failure mode maps to a stable `MercadoPagoError` code; the raw body is only
 * logged server-side, never returned to callers.
 */
async function postMercadoPagoJson(
  endpoint: string,
  body: unknown,
  idempotencyKey: string,
): Promise<Record<string, unknown>> {
  const { accessToken } = readCredentials()
  if (!accessToken) {
    throw new MercadoPagoError('missing_credentials', 'Mercado Pago access token is not configured')
  }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
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

  let parsed: unknown
  try {
    parsed = await response.json()
  } catch {
    throw new MercadoPagoError('invalid_response', 'Mercado Pago returned malformed JSON')
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new MercadoPagoError('invalid_response', 'Mercado Pago returned malformed JSON')
  }
  return parsed as Record<string, unknown>
}

/**
 * Extracts and validates the hosted-checkout URL from a create response
 * (`init_point` / `sandbox_init_point`, shared by preapprovals and Checkout
 * Pro preferences). A missing or hostile URL throws a typed error, so a
 * customer is never redirected to a foreign host.
 */
function parseCheckoutResponse(record: Record<string, unknown>): SubscriptionCreated {
  const { accessToken, sandboxToken } = readCredentials()
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

/**
 * Creates a Mercado Pago subscription (no associated plan) and returns the
 * hosted checkout URL. Throws `MercadoPagoError` with a machine-readable code;
 * the raw HTTP body is never surfaced to callers.
 */
export async function createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionCreated> {
  const record = await postMercadoPagoJson(
    PREAPPROVAL_ENDPOINT,
    {
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
    },
    input.idempotencyKey,
  )
  return parseCheckoutResponse(record)
}

/**
 * Creates a one-time Checkout Pro preference for a website build and returns
 * the hosted checkout URL. The amount is always the server-computed build
 * price (BRL); Mercado Pago handles the payment and redirects back through
 * `back_urls` with `auto_return: "approved"`.
 *
 * `paymentMethods` narrows the hosted checkout to the configured methods and
 * credit-card installments: `excluded_payment_types` removes every offered
 * type outside the policy, `installments` caps the maximum number of
 * installments (parcelado), and `default_installments: 1` preselects à vista.
 * Mercado Pago's wallet (`account_money`) cannot be excluded by preference.
 */
export async function createCheckoutPreference(input: CreateCheckoutPreferenceInput): Promise<SubscriptionCreated> {
  const record = await postMercadoPagoJson(
    CHECKOUT_PRO_PREFERENCES_ENDPOINT,
    {
      items: [
        {
          title: input.title,
          quantity: 1,
          unit_price: input.amountBRL,
          currency_id: 'BRL',
        },
      ],
      payment_methods: {
        excluded_payment_types: input.paymentMethods.excludedPaymentTypes.map((id) => ({ id })),
        installments: input.paymentMethods.maxInstallments,
        default_installments: input.paymentMethods.defaultInstallments,
      },
      back_urls: input.backUrls,
      auto_return: 'approved',
      external_reference: input.externalReference,
    },
    input.idempotencyKey,
  )
  return parseCheckoutResponse(record)
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

type GetResult = { found: true; record: Record<string, unknown> } | { found: false }

/**
 * GETs a Mercado Pago resource with the access token. A 404 maps to
 * `{ found: false }`; every other failure mode throws a typed
 * `MercadoPagoError`.
 */
async function getMercadoPagoJson(path: string): Promise<GetResult> {
  const { accessToken } = readCredentials()
  if (!accessToken) {
    throw new MercadoPagoError('missing_credentials', 'Mercado Pago access token is not configured')
  }

  let response: Response
  try {
    response = await fetch(path, {
      headers: { Authorization: `Bearer ${accessToken}` },
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
  if (response.status === 404) return { found: false }
  if (!response.ok) {
    await logMercadoPagoError(response, 'api_error')
    throw new MercadoPagoError('api_error', `Mercado Pago returned HTTP ${response.status}`)
  }

  let parsed: unknown
  try {
    parsed = await response.json()
  } catch {
    throw new MercadoPagoError('invalid_response', 'Mercado Pago returned malformed JSON')
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new MercadoPagoError('invalid_response', 'Mercado Pago returned malformed JSON')
  }
  return { found: true, record: parsed as Record<string, unknown> }
}

/**
 * Fetches a subscription directly from Mercado Pago and returns a sanitized
 * subset of its state. Returns `undefined` when credentials are missing or the
 * subscription does not exist (404). Nothing is cached or persisted locally.
 */
export async function getSubscription(subscriptionId: string): Promise<SubscriptionStatus | undefined> {
  if (!readCredentials().accessToken) return undefined

  const result = await getMercadoPagoJson(
    `${PREAPPROVAL_ENDPOINT}/${encodeURIComponent(subscriptionId)}`,
  )
  if (!result.found) return undefined
  if (typeof result.record.id !== 'string' || !result.record.id) {
    throw new MercadoPagoError('invalid_response', 'Mercado Pago response is missing id')
  }
  return mapSubscriptionStatus(result.record)
}

export type PaymentStatus = {
  id: string
  status: string | null
  statusDetail: string | null
  externalReference: string | null
  transactionAmount: number | null
  currencyId: string | null
}

/**
 * Fetches a one-time payment directly from Mercado Pago and returns a
 * sanitized subset of its state. Returns `undefined` when credentials are
 * missing or the payment does not exist (404). Nothing is cached or persisted
 * locally.
 */
export async function getPayment(paymentId: string): Promise<PaymentStatus | undefined> {
  if (!readCredentials().accessToken) return undefined

  const result = await getMercadoPagoJson(`${PAYMENTS_ENDPOINT}/${encodeURIComponent(paymentId)}`)
  if (!result.found) return undefined
  if (typeof result.record.id !== 'string' || !result.record.id) {
    throw new MercadoPagoError('invalid_response', 'Mercado Pago response is missing id')
  }
  return mapPaymentStatus(result.record)
}

/**
 * Maps a sanitized one-time payment status from a validated Mercado Pago
 * payment record. Only safe, typed fields are copied — everything else in the
 * response (card data, tokens, …) is dropped.
 */
function mapPaymentStatus(record: Record<string, unknown>): PaymentStatus {
  return {
    id: record.id as string,
    status: typeof record.status === 'string' ? record.status : null,
    statusDetail: typeof record.status_detail === 'string' ? record.status_detail : null,
    externalReference: typeof record.external_reference === 'string' ? record.external_reference : null,
    transactionAmount: typeof record.transaction_amount === 'number' ? record.transaction_amount : null,
    currencyId: typeof record.currency_id === 'string' ? record.currency_id : null,
  }
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
