/**
 * Shared path helpers for locale routing.
 *
 * Lives in its own module because both `src/lib/locale.ts` and
 * `src/lib/services.ts` import it (they import each other at module level,
 * so the helper cannot live in either).
 *
 * Edge-reachable: imports from this module must use the explicit `.ts`
 * extension.
 */

/**
 * Normalizes a URL pathname: guarantees a leading slash and strips trailing
 * slashes with a linear scan (avoids regex backtracking on long slash runs).
 */
export function normalizePath(pathname: string): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  if (path === '/') return path
  let end = path.length
  while (end > 1 && path.codePointAt(end - 1) === 47 /* '/' */) end -= 1
  return path.slice(0, end)
}
