import type { RequestHandler } from './$types'
import { CRON_SECRET_HEADER, isCronAuthorized } from '$lib/server/cron'

export const prerender = false
export const trailingSlash = 'ignore'

export const GET: RequestHandler = ({ request }) => {
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret) {
    return new Response('Cron secret is not configured', { status: 503 })
  }

  if (!isCronAuthorized(request, expectedSecret)) {
    return new Response(`Missing or invalid ${CRON_SECRET_HEADER}`, { status: 401 })
  }

  return new Response(null, { status: 204 })
}
