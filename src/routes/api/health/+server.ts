import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

// Liveness probe for the Coolify healthcheck. No secrets, no side effects.
export const prerender = false

export const GET: RequestHandler = () => json({ status: 'ok' })
