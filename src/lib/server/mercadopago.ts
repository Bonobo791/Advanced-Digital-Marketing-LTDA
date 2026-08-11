/**
 * Mercado Pago Checkout Pro server-side client.
 *
 * - `createCheckoutPreference`: creates a Checkout Pro preference (redirect
 *   flow) — no public key, no payment form on our site.
 * - `getMpPayment`: fetches a payment by id (used by the webhook to verify
 *   the real status instead of trusting the notification body).
 *
 * Both return `undefined` when `MERCADO_PAGO_ACCESS_TOKEN` is not configured,
 * letting callers answer 503 instead of crashing.
 */
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago'

export interface CheckoutPreferenceInput {
  /** Internal order id — sent as external_reference for reconciliation. */
  externalReference: string
  title: string
  description?: string
  currency: string
  /** Amount to charge, in integer cents of the currency. */
  unitPriceCents: number
  backUrls: { success: string; pending: string; failure: string }
  notificationUrl: string
  payerEmail?: string
}

export interface CreatedPreference {
  id: string
  /** Redirect target (sandbox or production, per the configured credentials). */
  initPoint: string
}

/**
 * Sandbox mode is detected by exact match: the configured access token must
 * equal `MERCADO_PAGO_SANDBOX_ACCESS_TOKEN` (set to the same value as
 * `MERCADO_PAGO_ACCESS_TOKEN` in the test environment). Anything else — an
 * unset sandbox variable or any other token — is treated as production.
 */
export function isSandboxAccessToken(
  accessToken: string | undefined,
  sandboxToken: string | undefined,
): boolean {
  // Empty strings are treated as unset — never a sandbox match.
  return !!accessToken && !!sandboxToken && accessToken === sandboxToken
}

/**
 * Picks the redirect URL from the preference response. The create-preference
 * response always carries BOTH `init_point` (production) and
 * `sandbox_init_point` (sandbox), so the choice must be driven by the
 * credentials in use — never by which field happens to be populated.
 */
export function selectCheckoutInitPoint(
  response: { init_point?: string; sandbox_init_point?: string },
  accessToken: string | undefined,
  sandboxToken: string | undefined,
): string | undefined {
  if (isSandboxAccessToken(accessToken, sandboxToken)) {
    return response.sandbox_init_point ?? response.init_point
  }
  return response.init_point ?? response.sandbox_init_point
}

function getClient(
  accessToken: string | undefined = process.env.MERCADO_PAGO_ACCESS_TOKEN,
): MercadoPagoConfig | undefined {
  return accessToken ? new MercadoPagoConfig({ accessToken }) : undefined
}

export async function createCheckoutPreference(
  input: CheckoutPreferenceInput,
): Promise<CreatedPreference | undefined> {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
  const sandboxToken = process.env.MERCADO_PAGO_SANDBOX_ACCESS_TOKEN
  const config = getClient(accessToken)
  if (!config) return undefined

  const preference = new Preference(config)
  const response = await preference.create({
    body: {
      items: [
        {
          id: input.externalReference,
          title: input.title,
          description: input.description,
          quantity: 1,
          currency_id: input.currency,
          unit_price: input.unitPriceCents / 100,
        },
      ],
      external_reference: input.externalReference,
      back_urls: input.backUrls,
      notification_url: input.notificationUrl,
      auto_return: 'approved',
      payer: input.payerEmail ? { email: input.payerEmail } : undefined,
    },
  })

  const initPoint = selectCheckoutInitPoint(response, accessToken, sandboxToken)
  if (!response.id || !initPoint) {
    throw new Error('Mercado Pago preference response is missing id or init_point')
  }
  return { id: response.id, initPoint }
}

export interface MpPaymentStatus {
  id: string
  status: string
  statusDetail: string | null
  paymentMethodId: string | null
  externalReference: string | null
}

export async function getMpPayment(paymentId: string): Promise<MpPaymentStatus | undefined> {
  const config = getClient()
  if (!config) return undefined

  const payment = new Payment(config)
  const response = await payment.get({ id: paymentId })
  return {
    id: String(response.id),
    status: response.status ?? 'unknown',
    statusDetail: response.status_detail ?? null,
    paymentMethodId: response.payment_method_id ?? null,
    externalReference: response.external_reference ?? null,
  }
}
