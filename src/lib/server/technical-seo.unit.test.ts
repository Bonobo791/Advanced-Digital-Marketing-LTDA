import { afterEach, describe, expect, it, vi } from 'vitest'
import markdown from '../content/technical-seo-en.md?raw'
import portugueseMarkdown from '../content/technical-seo-pt-br.md?raw'

async function parseMarkdown(source: string) {
  vi.resetModules()
  vi.doMock('../content/technical-seo-en.md?raw', () => ({ default: source }))
  return (await import('./technical-seo')).TECHNICAL_SEO_CONTENT
}

afterEach(() => {
  vi.doUnmock('../content/technical-seo-en.md?raw')
  vi.doUnmock('../content/technical-seo-pt-br.md?raw')
  vi.resetModules()
})

describe('Portuguese technical SEO Markdown parsing', () => {
  async function loadPortuguese(source: string) {
    vi.resetModules()
    vi.doMock('../content/technical-seo-pt-br.md?raw', () => ({ default: source }))
    return import('./technical-seo')
  }

  it('renders the Portuguese source rather than using the English article', async () => {
    const module = await loadPortuguese(portugueseMarkdown)
    expect(module.TECHNICAL_SEO_CONTENT_BY_LOCALE?.['pt-BR']).toMatchObject({
      title: 'SEO técnico para investigar problemas e validar correções',
      symptoms: { heading: 'Quando vale investigar SEO técnico' },
      scopeHeading: 'O que pode fazer parte do escopo',
      faqHeading: 'Perguntas frequentes',
    })
  })

  it('renders identical Portuguese content with CRLF line endings', async () => {
    const expected = (await loadPortuguese(portugueseMarkdown.replace(/\r\n/g, '\n'))).TECHNICAL_SEO_CONTENT_BY_LOCALE['pt-BR']
    const actual = (await loadPortuguese(portugueseMarkdown.replace(/\r?\n/g, '\r\n'))).TECHNICAL_SEO_CONTENT_BY_LOCALE['pt-BR']
    expect(actual).toEqual(expected)
    expect(actual.scope).toHaveLength(4)
    expect(actual.faqs).toHaveLength(5)
  })

  it.each([
    { name: 'missing heading', source: portugueseMarkdown.replace(/^# [^\r\n]+\r?\n/, ''), error: 'page heading' },
    { name: 'missing section', source: portugueseMarkdown.replace('## Quando vale investigar SEO técnico', '## Outra seção'), error: 'Quando vale investigar SEO técnico' },
    { name: 'duplicate section', source: `${portugueseMarkdown}\n## Quando vale investigar SEO técnico\n\nRepetida.\n`, error: 'Quando vale investigar SEO técnico' },
    { name: 'incomplete scope', source: portugueseMarkdown.replace(/^### Planejamento de conteúdo e topicalidade\r?\n/m, ''), error: 'scope or FAQ' },
    { name: 'incomplete FAQ', source: portugueseMarkdown.replace(/^### Que acesso é necessário\?\r?\n/m, ''), error: 'scope or FAQ' },
  ])('rejects $name rather than silently falling back to English', async ({ source, error }) => {
    await expect(loadPortuguese(source.replace(/\r?\n/g, '\r\n'))).rejects.toThrow(error)
  })
})

describe('technical SEO Markdown parsing', () => {
  it.each([
    { name: 'page heading', source: markdown.replace(/^(# [^\r\n]+)\r?\n/, '$1\r\n') },
    { name: 'H2 headings', source: markdown.replace(/^(## [^\r\n]+)\r?\n/gm, '$1\r\n') },
    { name: 'H3 headings', source: markdown.replace(/^(### [^\r\n]+)\r?\n/gm, '$1\r\n') },
    { name: 'all lines', source: markdown.replace(/\r?\n/g, '\r\n') },
  ])('keeps identical content with CRLF in $name', async ({ source }) => {
    const expected = await parseMarkdown(markdown.replace(/\r\n/g, '\n'))
    const actual = await parseMarkdown(source)

    expect(actual).toEqual(expected)
    expect(actual.title).not.toContain('\r')
    expect(actual.scope).toHaveLength(4)
    expect(actual.faqs).toHaveLength(5)
    for (const section of [...actual.scope, ...actual.faqs]) {
      expect(section.heading).not.toContain('\r')
    }
  })

  it.each([
    {
      name: 'missing page heading',
      source: markdown.replace(/^# [^\r\n]+\r?\n/, ''),
      error: 'Technical SEO copy is missing its page heading',
    },
    {
      name: 'missing required section',
      source: markdown.replace('## When technical SEO help is useful', '## Unrecognized section'),
      error: "Technical SEO copy needs exactly one 'When technical SEO help is useful' section",
    },
    {
      name: 'duplicate required section',
      source: `${markdown}\n## When technical SEO help is useful\n\nDuplicate section.\n`,
      error: "Technical SEO copy needs exactly one 'When technical SEO help is useful' section",
    },
    {
      name: 'incomplete scope',
      source: markdown.replace(/^### Content and topical planning\r?\n/m, ''),
      error: 'Technical SEO scope or FAQ sections are incomplete',
    },
    {
      name: 'incomplete FAQ',
      source: markdown.replace(/^### Can ADM work with an in-house developer or an agency\?\r?\n/m, ''),
      error: 'Technical SEO scope or FAQ sections are incomplete',
    },
  ])('rejects $name with CRLF', async ({ source, error }) => {
    await expect(parseMarkdown(source.replace(/\r?\n/g, '\r\n'))).rejects.toThrow(error)
  })
})
