/**
 * Blog content pipeline — SERVER/BUILD ONLY (lives in $lib/server so SvelteKit
 * rejects any client import). Keeping the raw Markdown and `marked` here means
 * blog visitors never download the article source or the parser; the routes
 * receive the rendered result through their `+page.server.ts` loaders.
 */
import { marked } from 'marked'
import articleMarkdown from '../../../docs/ChatGPT-Ads-Complete-Guide-August-2026.md?raw'

export type BlogArticle = {
  slug: string
  title: string
  metaTitle: string
  description: string
  published: string
  updated: string
  html: string
}

/** Splits the YAML frontmatter block off the article body, parsing `key: value`
 *  scalars (quoted or bare). Unknown keys are ignored. */
function splitFrontmatter(markdown: string): { fields: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(markdown)
  if (!match) throw new Error('Blog article is missing its frontmatter')
  const fields: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const kv = /^([a-z_]+):\s*(.+?)\s*$/.exec(line)
    if (kv) fields[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1')
  }
  return { fields, body: markdown.slice(match[0].length) }
}

/** Frontmatter is the single source of truth for article metadata — a missing
 *  key must break the build rather than ship an empty <title> or og tag. */
function requiredField(fields: Record<string, string>, key: string): string {
  const value = fields[key]
  if (!value) throw new Error(`Blog article frontmatter is missing '${key}'`)
  return value
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function requiredDate(fields: Record<string, string>, key: string): string {
  const value = requiredField(fields, key)
  if (!ISO_DATE.test(value)) throw new Error(`Blog article frontmatter '${key}' must be YYYY-MM-DD (got '${value}')`)
  return value
}

function publicArticleMarkdown(markdown: string): string {
  const appendixMarker = '\n## Publishing Appendix:'
  const appendixStart = markdown.indexOf(appendixMarker)
  // Fail closed: a renamed or missing appendix heading must break the build,
  // not silently publish the internal publishing notes.
  if (appendixStart === -1) throw new Error("Blog article is missing its '## Publishing Appendix:' marker")
  let body = markdown.slice(0, appendixStart).trimEnd()
  // Strip the thematic break that separated the article from the appendix so
  // the public page does not end with an empty divider.
  if (body.endsWith('---')) body = body.slice(0, body.length - 3).trimEnd()
  return `${body}\n`
}

const { fields: frontmatter, body } = splitFrontmatter(articleMarkdown)
const renderedArticle = marked.parse(publicArticleMarkdown(body), { async: false, gfm: true })

if (typeof renderedArticle !== 'string') throw new Error('Blog article rendering must be synchronous')

export const CHATGPT_ADS_ARTICLE: BlogArticle = {
  // The slug is the route directory name — src/routes/blog/<slug>/.
  slug: 'chatgpt-ads-complete-guide-august-2026',
  title: requiredField(frontmatter, 'title'),
  metaTitle: requiredField(frontmatter, 'meta_title'),
  description: requiredField(frontmatter, 'meta_description'),
  published: requiredDate(frontmatter, 'published'),
  updated: requiredDate(frontmatter, 'updated'),
  html: renderedArticle,
}

export const BLOG_ARTICLES: readonly BlogArticle[] = [CHATGPT_ADS_ARTICLE]
