// Approved project copy is rendered on the server. The browser receives HTML,
// never the Markdown source or a Markdown parser.
import { marked } from 'marked'
import markdown from '../content/technical-seo-en.md?raw'
import portugueseMarkdown from '../content/technical-seo-pt-br.md?raw'
import { L, resolveCopy } from '$lib/localized-copy'
import type { Locale } from '$lib/locale'
import type { CopySection, TechnicalSeoContent } from '$lib/technical-seo'

function sections(source: string, depth: 2 | 3): { intro: string; items: (CopySection & { source: string })[] } {
  const parts = source.split(depth === 2 ? /^## ([^\r\n]+)\r?\n/m : /^### ([^\r\n]+)\r?\n/m)
  const items: (CopySection & { source: string })[] = []
  for (let index = 1; index < parts.length; index += 2) {
    items.push({ heading: parts[index], html: marked.parse(parts[index + 1], { async: false }), source: parts[index + 1] })
  }
  return { intro: parts[0], items }
}

const SECTION_NAMES = {
  symptoms: L('When technical SEO help is useful', 'Quando vale investigar SEO técnico'),
  scope: L('What a scoped engagement can cover', 'O que pode fazer parte do escopo'),
  example: L('A synthetic example of an inspectable fix', 'Exemplo sintético de uma correção verificável'),
  deliverables: L('Prioritized deliverables and reporting', 'Entregáveis e acompanhamento'),
  access: L('Access, scope, and fees', 'Acesso, escopo e valores'),
  faqs: L('Frequently asked questions', 'Perguntas frequentes'),
  contact: L('Contact ADM', 'Fale com a ADM'),
}

type SectionNames = { [K in keyof typeof SECTION_NAMES]: string }

function parseTechnicalSeo(source: string, locale: Locale): TechnicalSeoContent {
  const names = resolveCopy<SectionNames>(SECTION_NAMES, locale)
  const heading = /^# ([^\r\n]+)\r?\n/.exec(source)
  if (!heading) throw new Error(`Technical SEO copy is missing its page heading (${locale})`)
  const copy = sections(source.slice(heading[0].length), 2)

  function required(name: string) {
    const matches = copy.items.filter((item) => item.heading === name)
    if (matches.length !== 1) throw new Error(`Technical SEO copy needs exactly one '${name}' section (${locale})`)
    return matches[0]
  }

  const scope = required(names.scope)
  const faqs = required(names.faqs)
  const scopeItems = sections(scope.source, 3).items
  const faqItems = sections(faqs.source, 3).items
  if (scopeItems.length !== 4 || faqItems.length !== 5) throw new Error(`Technical SEO scope or FAQ sections are incomplete (${locale})`)

  function publicCopy(name: string): CopySection {
    const { heading, html } = required(name)
    return { heading, html }
  }

  return {
    title: heading[1],
    intro: marked.parse(copy.intro, { async: false }),
    symptoms: publicCopy(names.symptoms),
    scopeHeading: scope.heading,
    scope: scopeItems.map(({ heading, html }) => ({ heading, html })),
    example: publicCopy(names.example),
    deliverables: publicCopy(names.deliverables),
    access: publicCopy(names.access),
    faqHeading: faqs.heading,
    faqs: faqItems.map(({ heading, html }) => ({ heading, html })),
    contact: publicCopy(names.contact),
  }
}

export const TECHNICAL_SEO_CONTENT_BY_LOCALE: Record<Locale, TechnicalSeoContent> = {
  'en-US': parseTechnicalSeo(markdown, 'en-US'),
  'pt-BR': parseTechnicalSeo(portugueseMarkdown, 'pt-BR'),
}

export const TECHNICAL_SEO_CONTENT = TECHNICAL_SEO_CONTENT_BY_LOCALE['en-US']
