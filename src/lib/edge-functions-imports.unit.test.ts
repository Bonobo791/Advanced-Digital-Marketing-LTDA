/**
 * Regression guard for Netlify edge-function bundling.
 *
 * Netlify bundles each edge function with esbuild, which does NOT understand
 * SvelteKit's `$lib`/`$app` aliases — it treats `$lib/...` as an npm module and
 * fails the whole build (exit code 2) during the post-build "Edge Functions
 * bundling" step. Local `netlify build` can resolve the alias via tsconfig
 * paths, so the failure is only visible on the remote build image.
 *
 * This test statically walks the import graph reachable from
 * `netlify/edge-functions/` and fails if any reachable source file contains a
 * runtime (non type-only) `$lib`/`$app` import, or a relative import without an
 * explicit file extension. Both are invisible to esbuild-style local resolution
 * but break the remote eszip bundler. Type-only imports are safe: esbuild
 * erases them before bundling.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const EDGE_FUNCTIONS_DIR = join(PROJECT_ROOT, 'netlify', 'edge-functions')
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs'])
const SVELTEKIT_ALIASES = ['$lib', '$app']

// Matches `import { x } from '...'`, `export { x } from '...'`, and `export * from '...'`
// while rejecting `import type` / `export type`. The `s` flag lets the body span lines.
const RUNTIME_IMPORT_RE = /\b(?:import|export)\s+(?!type\b)[^'"]*?\s+from\s+['"]([^'"]+)['"]/gs
const DYNAMIC_IMPORT_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g

/** Resolve a relative specifier the way esbuild would (try extensions, index files). */
function resolveRelative(fromFile: string, specifier: string): string | undefined {
  const base = resolve(dirname(fromFile), specifier)
  const candidates = [base]
  if (!extname(base)) {
    for (const ext of SOURCE_EXTENSIONS) candidates.push(`${base}${ext}`)
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const index = join(candidate, 'index.ts')
      if (SOURCE_EXTENSIONS.has(extname(candidate))) return candidate
      if (existsSync(index)) return index
    }
  }
  return undefined
}

/** Collect every specifier in a module that the bundler must resolve at runtime. */
function runtimeSpecifiers(source: string): string[] {
  const specifiers: string[] = []
  for (const match of source.matchAll(RUNTIME_IMPORT_RE)) specifiers.push(match[1])
  for (const match of source.matchAll(DYNAMIC_IMPORT_RE)) specifiers.push(match[1])
  return specifiers
}

function findForbiddenSvelteKitImports(): { file: string; specifier: string }[] {
  const violations: { file: string; specifier: string }[] = []
  const visited = new Set<string>()
  const queue = listDirectory(EDGE_FUNCTIONS_DIR)

  while (queue.length > 0) {
    const file = queue.shift()!
    if (visited.has(file)) continue
    visited.add(file)
    if (!SOURCE_EXTENSIONS.has(extname(file))) continue

    const source = readFileSync(file, 'utf8')
    for (const specifier of runtimeSpecifiers(source)) {
      if (SVELTEKIT_ALIASES.some((alias) => specifier === alias || specifier.startsWith(`${alias}/`))) {
        violations.push({ file: relativeToRoot(file), specifier })
      } else if (specifier.startsWith('.')) {
        // Netlify's edge bundler (eszip) resolves relative specifiers as exact
        // file paths — it does not probe for extensions. Require them here.
        if (!SOURCE_EXTENSIONS.has(extname(specifier))) {
          violations.push({ file: relativeToRoot(file), specifier })
        }
        const resolved = resolveRelative(file, specifier)
        if (resolved && !visited.has(resolved)) queue.push(resolved)
      }
    }
  }
  return violations
}

function listDirectory(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(dir, entry.name))
}

function relativeToRoot(file: string): string {
  return file.slice(PROJECT_ROOT.length)
}

describe('netlify edge-function import graph', () => {
  it('resolves every import reachable from netlify/edge-functions/ without $lib/$app aliases or extension-less relative paths', () => {
    const violations = findForbiddenSvelteKitImports()
    expect(violations).toEqual([])
  })
})
