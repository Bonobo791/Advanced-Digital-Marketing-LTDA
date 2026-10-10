import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PAGE_META, LOCALE_ROUTES, SERVICES_INDEX_META, SERVICES_INDEX_ROUTES, SITE_ORIGIN } from './locale'
import { SERVICE_META, SERVICE_ROUTES } from './services'
import { CHATGPT_ADS_ARTICLE } from './server/blog'

const host = '127.0.0.1'
const port = 4179
const origin = process.env.PAGE_TITLES_BASE_URL ?? `http://${host}:${port}`
const routes = [
  ...Object.entries(LOCALE_ROUTES).flatMap(([page, localized]) =>
    Object.entries(localized).map(([locale, path]) => ({
      path,
      title: PAGE_META[locale as keyof typeof PAGE_META][page as keyof typeof PAGE_META['en-US']].title,
    })),
  ),
  ...Object.entries(SERVICES_INDEX_ROUTES).map(([locale, path]) => ({
    path,
    title: SERVICES_INDEX_META[locale as keyof typeof SERVICES_INDEX_META].title,
  })),
  ...Object.entries(SERVICE_ROUTES).flatMap(([service, localized]) =>
    Object.entries(localized).map(([locale, path]) => ({
      path,
      title: SERVICE_META[locale as keyof typeof SERVICE_META][service as keyof typeof SERVICE_META['en-US']].title,
    })),
  ),
  { path: '/blog/', title: 'Blog | Advanced Digital Marketing LTDA' },
  {
    path: '/blog/chatgpt-ads-complete-guide-august-2026/',
    title: `${CHATGPT_ADS_ARTICLE.metaTitle} | Advanced Digital Marketing LTDA`,
  },
  { path: '/contact/verify/', title: PAGE_META['en-US'].contact.title },
  { path: '/pt-br/contato/verificar/', title: PAGE_META['pt-BR'].contact.title },
  { path: '/checkout/complete/', title: 'Payment result | Advanced Digital Marketing LTDA' },
  { path: '/pt-br/checkout/complete/', title: 'Pagamento | Advanced Digital Marketing LTDA' },
]

let server: ChildProcessWithoutNullStreams
let serverOutput = ''

beforeAll(async () => {
  if (process.env.PAGE_TITLES_BASE_URL) return
  server = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'dev', '--host', host, '--port', String(port), '--strictPort'],
    { cwd: process.cwd(), stdio: 'pipe' },
  )
  server.stdout.on('data', (chunk: Buffer) => { serverOutput += chunk.toString() })
  server.stderr.on('data', (chunk: Buffer) => { serverOutput += chunk.toString() })

  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Vite stopped before startup:\n${serverOutput}`)
    try {
      await fetch(origin)
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  throw new Error(`Vite did not become ready:\n${serverOutput}`)
}, 15_000)

afterAll(() => {
  server?.kill('SIGTERM')
})

async function page(path: string) {
  const response = await fetch(new URL(path, origin))
  return { response, html: await response.text() }
}

function titles(html: string): string[] {
  return [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)].map(([, title]) =>
    title.replace(/&amp;/g, '&').trim(),
  )
}

function documentHead(html: string): string {
  const match = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html)
  if (!match) throw new Error('Rendered document has no head element')
  return match[1]
}

describe('rendered page titles', () => {
  it.each(routes)('renders one appropriate title and preserves the canonical for $path', async ({ path, title }) => {
    const { response, html } = await page(path)
    const head = documentHead(html)
    expect(response.status).toBe(200)
    expect(titles(head)).toEqual([title])
    expect(head.match(/rel="canonical"/g)).toHaveLength(1)
    expect(head).toContain(`href="${SITE_ORIGIN}${path}"`)
  })

  it('renders one error title without a canonical for an unknown route', async () => {
    const { response, html } = await page('/missing-title-regression/')
    const head = documentHead(html)
    expect(response.status).toBe(404)
    expect(titles(head)).toEqual(['404 | Advanced Digital Marketing LTDA'])
    expect(head).not.toContain('rel="canonical"')
    expect(head).toContain('<meta name="robots" content="noindex"')
  })
})
