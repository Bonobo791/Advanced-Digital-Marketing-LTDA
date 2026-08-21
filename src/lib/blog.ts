import { marked } from 'marked'
import articleMarkdown from '../../docs/ChatGPT-Ads-Complete-Guide-August-2026.md?raw'

export type BlogArticle = {
  slug: string
  title: string
  metaTitle: string
  description: string
  published: string
  updated: string
  html: string
}

function withoutFrontmatter(markdown: string): string {
  const match = markdown.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/)
  if (!match) throw new Error('Blog article is missing its frontmatter')
  return markdown.slice(match[0].length)
}

function publicArticleMarkdown(markdown: string): string {
  const appendixMarker = '\n## Publishing Appendix:'
  const appendixStart = markdown.indexOf(appendixMarker)
  return appendixStart === -1 ? markdown : markdown.slice(0, appendixStart).trimEnd() + '\n'
}

const publicMarkdown = publicArticleMarkdown(withoutFrontmatter(articleMarkdown))
const renderedArticle = marked.parse(publicMarkdown, { async: false, gfm: true })

if (typeof renderedArticle !== 'string') throw new Error('Blog article rendering must be synchronous')

export const CHATGPT_ADS_ARTICLE: BlogArticle = {
  slug: 'chatgpt-ads-complete-guide-august-2026',
  title: 'ChatGPT Ads: The Complete Guide to OpenAI\'s Advertising Platform (August 21, 2026)',
  metaTitle: 'ChatGPT Ads Guide 2026: Pricing, Formats, Targeting & New Features',
  description:
    'A complete guide to ChatGPT Ads in August 2026: pricing, formats, targeting, measurement, policies, markets, and campaign setup.',
  published: '2026-08-21',
  updated: '2026-08-21',
  html: renderedArticle,
}

export const BLOG_ARTICLES: readonly BlogArticle[] = [CHATGPT_ADS_ARTICLE]
