function hasTokenQuery(url: URL): boolean {
  return Array.from(url.searchParams.keys()).some((key) => key.toLowerCase() === 'token')
}

/** Keep contact forms and token-bearing documents outside third-party analytics. */
export function isSensitiveAnalyticsUrl(url: URL): boolean {
  // SvelteKit decodes route names; encoded spellings must get the same policy.
  // Malformed paths fail closed without logging their potentially private URL.
  let pathname: string
  try {
    pathname = decodeURI(url.pathname).toLowerCase()
  } catch {
    console.warn('[analytics] malformed pathname; analytics disabled')
    return true
  }
  return /^\/(?:contact|pt-br\/contato)(?:\/|$)/.test(pathname)
    || hasTokenQuery(url)
}

/**
 * Canonical contact forms need their same-origin POST Origin for SvelteKit's
 * CSRF check. Suppress cross-origin referrers while retaining that Origin;
 * verification/token documents keep suppressing referrers to every origin.
 */
export function sensitiveDocumentReferrerPolicy(url: URL): 'same-origin' | 'no-referrer' {
  const contactForm = url.pathname === '/contact/' || url.pathname === '/pt-br/contato/'
  return contactForm && !hasTokenQuery(url) ? 'same-origin' : 'no-referrer'
}

/** Never forward a verification URL through a later safe page's referrer. */
export function analyticsReferrer(referrer: string): string {
  if (!referrer) return ''
  try {
    const url = new URL(referrer)
    return isSensitiveAnalyticsUrl(url) ? '' : `${url.origin}${url.pathname}`
  } catch {
    console.warn('[analytics] invalid referrer; referrer omitted')
    return ''
  }
}
