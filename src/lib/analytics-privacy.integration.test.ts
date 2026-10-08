import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { handle } from '../hooks.server'
import type { RequestEvent } from '@sveltejs/kit'

function eventFor(path: string, language?: string): RequestEvent {
  const url = new URL(path, 'https://example.test')
  return {
    url,
    request: new Request(url),
    cookies: { get: () => language, set: vi.fn(), delete: vi.fn() },
  } as unknown as RequestEvent
}

describe('analytics document isolation', () => {
  it('never emits an unconditional analytics script in the HTML template', () => {
    const html = readFileSync(new URL('../app.html', import.meta.url), 'utf8')
    expect(html).not.toContain('googletagmanager.com')
    expect(html).not.toContain("gtag('config'")
  })

  it.each(['/contact/verify/?token=synthetic.token', '/pt-br/contato/verificar/?token=synthetic.token', '/about/?token=synthetic.token', '/contact/?TOKEN=synthetic.token', '/pt-br/contato/?%74oken=synthetic.token'])('suppresses all outgoing referrers on token-bearing %s', async (path) => {
    const response = await handle({
      event: eventFor(path),
      resolve: async () => new Response('<!doctype html>'),
    })
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
  })

  it.each(['/contact/', '/contact/?subject=synthetic-service', '/pt-br/contato/', '/pt-br/contato/?error=invalid_email&subject=synthetic-service'])('retains the same-origin native form Origin while suppressing cross-origin referrers on %s', async (path) => {
    const response = await handle({
      event: eventFor(path),
      resolve: async () => new Response('<!doctype html>'),
    })
    expect(response.headers.get('Referrer-Policy')).toBe('same-origin')
  })

  it.each(['/contact/verify/', '/pt-br/contato/verificar/', '/contact/future/', '/%63ontact/'])('keeps the strict policy outside the canonical contact form on %s', async (path) => {
    const response = await handle({ event: eventFor(path), resolve: async () => new Response('<!doctype html>') })
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
  })

  it('keeps the policy on locale redirects carrying a token', async () => {
    const response = await handle({ event: eventFor('/?token=synthetic.token', 'pt-BR'), resolve: vi.fn() })
    expect(response.status).toBe(307)
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
  })

  it('preserves ordinary route response policies', async () => {
    const response = await handle({
      event: eventFor('/services/'),
      resolve: async () => new Response('safe', { headers: { 'Referrer-Policy': 'strict-origin-when-cross-origin' } }),
    })
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })
})
