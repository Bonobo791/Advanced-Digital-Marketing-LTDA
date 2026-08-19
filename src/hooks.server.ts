import type { Handle } from '@sveltejs/kit'
import { applyLocaleEdge, geoCountryFromHeaders } from '$lib/locale-edge'

export const handle: Handle = async ({ event, resolve }) => {
  // Locale routing (port of the former Netlify edge function): redirect the
  // root to /pt-br/ when the language cookie says pt-BR, and set/clear the
  // geo_br suggestion flag from the CDN-forwarded country header.
  const decision = applyLocaleEdge(event.request, event.cookies.get('language'), geoCountryFromHeaders(event.request.headers))
  if (decision.type === 'redirect') {
    return new Response(null, {
      status: 307,
      headers: {
        Location: new URL(decision.location, event.url).toString(),
        'Cache-Control': 'private, no-store',
      },
    })
  }
  if (decision.geoBr === true) {
    event.cookies.set('geo_br', '1', { path: '/', sameSite: 'lax', secure: true })
  } else if (decision.geoBr === false) {
    // The cookie is set with path '/', so the delete must target the same
    // path — otherwise the geo cookie never expires for the user.
    event.cookies.delete('geo_br', { path: '/' })
  }

  const language = event.url.pathname === '/pt-br' || event.url.pathname.startsWith('/pt-br/') ? 'pt-BR' : 'en'

  const response = await resolve(event, {
    transformPageChunk: ({ html }) => html.replace('<html lang="en">', `<html lang="${language}">`),
  })
  // The root HTML depends on the language cookie (307 vs 200 above): if Bunny
  // cached it, a visitor with language=pt-BR could be served the English root
  // without ever reaching this hook. The root must never be shared-cacheable.
  if (event.url.pathname === '/') {
    response.headers.set('Cache-Control', 'private, no-store')
  }
  return response
}
