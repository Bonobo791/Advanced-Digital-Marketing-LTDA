import type { Handle } from '@sveltejs/kit'

export const handle: Handle = async ({ event, resolve }) => {
  const language = event.url.pathname === '/pt-br' || event.url.pathname.startsWith('/pt-br/') ? 'pt-BR' : 'en'

  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace('<html lang="en">', `<html lang="${language}">`),
  })
}
