/**
 * HTTP status for a rejected webhook delivery, shared by the Mercado Pago and
 * Stripe receivers (extracted from the routes; SonarCloud S3358 forbids the
 * nested ternary this replaces, and the mapping must stay identical in both).
 *
 * Both providers retry non-2xx: a misconfigured secret (503) and a transient
 * processing failure (500, event unmarked) should be retried, while a bad
 * signature / stale timestamp is rejected outright — retrying would never
 * succeed. The outright-rejection status differs per provider convention:
 * Mercado Pago gets 401, Stripe 400 (see the route modules).
 */
export function webhookRejectionStatus(code: string, rejectStatus: number): number {
  if (code === 'missing_secret') return 503
  if (code === 'processing_failed') return 500
  return rejectStatus
}
