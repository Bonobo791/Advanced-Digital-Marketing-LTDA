import { afterEach, describe, expect, it, vi } from 'vitest'
import markdown from '../content/technical-seo-en.md?raw'

async function parseMarkdown(source: string) {
  vi.resetModules()
  vi.doMock('../content/technical-seo-en.md?raw', () => ({ default: source }))
  return (await import('./technical-seo')).TECHNICAL_SEO_CONTENT
}

afterEach(() => {
  vi.doUnmock('../content/technical-seo-en.md?raw')
  vi.resetModules()
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
      source: markdown.replace('## Summary', '## Unrecognized section'),
      error: "Technical SEO copy needs exactly one 'Summary' section",
    },
    {
      name: 'duplicate required section',
      source: `${markdown}\n## Summary\n\nDuplicate section.\n`,
      error: "Technical SEO copy needs exactly one 'Summary' section",
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
