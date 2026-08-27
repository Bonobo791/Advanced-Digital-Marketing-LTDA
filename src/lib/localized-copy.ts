/**
 * Machinery for declaring bilingual copy ONCE per leaf instead of as two
 * parallel locale object literals.
 *
 * The copy modules (constants.ts, services.ts) used to spell out the full
 * object structure twice — once for en-US, once for pt-BR — which is what the
 * SonarCloud duplication gate flagged (the en and pt blocks are token-identical
 * once string literals are normalized). Now each leaf is declared as:
 *
 *   L('English text', 'Texto em português')   — translated string
 *   C('shared value')                          — locale-invariant string
 *     (JP marks, e-mail subjects, anchors, catalog ids)
 *
 * Non-string leaves (numbers, null) are written as-is. The table is then
 * resolved into the plain per-locale shape the components consume, so the
 * public types (PageCopy, ServiceContent, …) are unchanged.
 */
import type { Locale } from './locale'

/** Translated copy leaf: L(en-US, pt-BR). */
export type L10n = { readonly $: readonly [enUS: string, ptBR: string] }
export const L = (enUS: string, ptBR: string): L10n => ({ $: [enUS, ptBR] })

/** Locale-invariant copy leaf (same string in both locales). */
export type ConstCopy = { readonly c: string }
export const C = (value: string): ConstCopy => ({ c: value })

/** The declared shape of a copy table: strings become L()/C() leaves. */
export type CopySource<T> =
  T extends string ? L10n | ConstCopy
    : T extends readonly unknown[] ? { [K in keyof T]: CopySource<T[K]> }
      : T extends object ? { [K in keyof T]: CopySource<T[K]> }
        : T

function isL10n(node: object): node is L10n {
  return '$' in node
}

function isConstCopy(node: object): node is ConstCopy {
  return 'c' in node
}

function resolveNode(node: unknown, locale: Locale): unknown {
  if (node === null || typeof node !== 'object') return node
  if (isL10n(node)) return node.$[locale === 'pt-BR' ? 1 : 0]
  if (isConstCopy(node)) return node.c
  if (Array.isArray(node)) return node.map((item) => resolveNode(item, locale))
  return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, resolveNode(value, locale)]))
}

/** Resolves a declared copy table into its plain per-locale shape. */
export function resolveCopy<T>(source: CopySource<T>, locale: Locale): T {
  return resolveNode(source, locale) as T
}
