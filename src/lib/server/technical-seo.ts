// Approved project copy is rendered on the server. The browser receives HTML,
// never the Markdown source or a Markdown parser.
import { marked } from 'marked'
import markdown from '../content/technical-seo-en.md?raw'
import type { CopySection, TechnicalSeoContent } from '$lib/technical-seo'

function sections(source: string, depth: 2 | 3): { intro: string; items: (CopySection & { source: string })[] } {
  const parts = source.split(new RegExp('^' + '#'.repeat(depth) + ' (.+)\\n', 'm'))
  const items: (CopySection & { source: string })[] = []
  for (let index = 1; index < parts.length; index += 2) {
    items.push({ heading: parts[index], html: marked.parse(parts[index + 1], { async: false }), source: parts[index + 1] })
  }
  return { intro: parts[0], items }
}

const heading = /^# (.+)\n/.exec(markdown)
if (!heading) throw new Error('Technical SEO copy is missing its page heading')
const copy = sections(markdown.slice(heading[0].length), 2)

function required(name: string) {
  const matches = copy.items.filter((item) => item.heading === name)
  if (matches.length !== 1) throw new Error(`Technical SEO copy needs exactly one '${name}' section`)
  return matches[0]
}

const scope = required('What a scoped engagement can cover')
const faqs = required('Frequently asked questions')
const scopeItems = sections(scope.source, 3).items
const faqItems = sections(faqs.source, 3).items
if (scopeItems.length !== 4 || faqItems.length !== 5) throw new Error('Technical SEO scope or FAQ sections are incomplete')

function publicCopy(name: string): CopySection {
  const { heading, html } = required(name)
  return { heading, html }
}

export const TECHNICAL_SEO_CONTENT: TechnicalSeoContent = {
  title: heading[1],
  intro: marked.parse(copy.intro, { async: false }),
  summary: publicCopy('Summary'),
  takeaways: publicCopy('Key Takeaways'),
  symptoms: publicCopy('When technical SEO help is useful'),
  scopeHeading: scope.heading,
  scope: scopeItems.map(({ heading, html }) => ({ heading, html })),
  example: publicCopy('A synthetic example of an inspectable fix'),
  deliverables: publicCopy('Prioritized deliverables and reporting'),
  access: publicCopy('Access, scope, and fees'),
  faqHeading: faqs.heading,
  faqs: faqItems.map(({ heading, html }) => ({ heading, html })),
  author: publicCopy('About the author'),
}
