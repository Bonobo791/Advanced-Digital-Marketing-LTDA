import { SITE_ORIGIN } from './locale'

/** The public page URL, independent of request host, query parameters, or fragments. */
export function canonicalUrl(pathname: string): string {
  if (!pathname.startsWith('/') || pathname.startsWith('//') || pathname.includes('\\')) {
    throw new Error('Canonical URLs require a root-relative page path')
  }

  const url = new URL(pathname, SITE_ORIGIN)
  if (url.origin !== SITE_ORIGIN) {
    throw new Error('Canonical URLs require a root-relative page path')
  }
  url.search = ''
  url.hash = ''
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  return url.href
}
