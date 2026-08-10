import { decideLocaleRequest } from '../../src/lib/locale.ts'

type EdgeContext = {
  cookies: {
    get(name: string): string | undefined
    set(options: { name: string; value: string; path: string; sameSite: 'lax'; secure: boolean }): void
    delete(options: { name: string; path: string }): void
  }
  geo: { country?: { code?: string } }
  next(): Response | Promise<Response>
}

export default function locale(request: Request, context: EdgeContext) {
  const url = new URL(request.url)
  const decision = decideLocaleRequest({
    method: request.method,
    pathname: url.pathname,
    search: url.search,
    language: context.cookies.get('language'),
    country: context.geo.country?.code,
  })

  if (decision.type === 'redirect') {
    return new Response(null, {
      status: 307,
      headers: {
        Location: new URL(decision.location, request.url).toString(),
        'Cache-Control': 'private, no-store',
      },
    })
  }

  if (decision.geoBr === true) {
    context.cookies.set({ name: 'geo_br', value: '1', path: '/', sameSite: 'lax', secure: true })
  } else if (decision.geoBr === false) {
    context.cookies.delete({ name: 'geo_br', path: '/' })
  }

  return context.next()
}

export const config = {
  path: ['/', '/about', '/about/', '/contact', '/contact/'],
  method: ['GET'],
}
