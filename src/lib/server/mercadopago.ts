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
  /** Redirect target (sandbox URL in test mode). */
  initPoint: string
}

function getClient(): MercadoPagoConfig | undefined {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
  return accessToken ? new MercadoPagoConfig({ accessToken }) : undefined
}

export async function createCheckoutPreference(
  input: CheckoutPreferenceInput,
): Promise<CreatedPreference | undefined> {
  const config = getClient()
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

  const initPoint = response.sandbox_init_point ?? response.init_point
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
