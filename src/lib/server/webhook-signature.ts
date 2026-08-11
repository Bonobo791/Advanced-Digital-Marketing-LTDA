/**
 * Mercado Pago webhook signature validation.
 *
 * Uses the official SDK validator (HMAC-based, constant-time compare).
 * Mercado Pago signs notifications with the secret configured in
 * Suas integrações > Webhooks; the `x-signature` header carries
 * `ts=<unix seconds>,v1=<hex hmac>` and the notification URL carries the
 * signed `data.id` query parameter.
 */
import { InvalidWebhookSignatureError, WebhookSignatureValidator } from 'mercadopago'

export interface SignatureInput {
  xSignature: string | null
  xRequestId: string | null
  /** The `data.id` query parameter of the notification URL. */
  dataId: string
  secret: string
}

export function isWebhookSignatureValid(input: SignatureInput): boolean {
  try {
    WebhookSignatureValidator.validate({
      xSignature: input.xSignature,
      xRequestId: input.xRequestId,
      dataId: input.dataId,
      secret: input.secret,
      // Reject replays older than 5 minutes.
      toleranceSeconds: 300,
    })
    return true
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) return false
    throw error
  }
}
