import { timingSafeEqual } from 'node:crypto'

export const CRON_SECRET_HEADER = 'x-cron-secret'

export function isCronAuthorized(request: Request, expectedSecret: string | undefined): boolean {
  if (!expectedSecret) return false

  const receivedSecret = request.headers.get(CRON_SECRET_HEADER)
  if (!receivedSecret) return false

  const expected = Buffer.from(expectedSecret)
  const received = Buffer.from(receivedSecret)

  return received.length === expected.length && timingSafeEqual(received, expected)
}
