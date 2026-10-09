import { describe, expect, it } from 'vitest'
import markdown from './technical-seo-pt-br.md?raw'

// This consumes the actual published specimen, not a second copy of its HTML.
// The fictional HTTP response and account outcomes are deliberately not tested.
function canonicalSpecimen(source = markdown) {
  const example = source.split(/^## Exemplo sintético de uma correção verificável\r?\n/m)[1]?.split(/^## /m)[0]
  const html = example?.match(/```html\r?\n([\s\S]*?)```/)?.[1]
  if (!html) throw new Error('The synthetic demonstration needs its HTML specimen')
  return [...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]+)"\s*>/g)].map((match) => match[1])
}

describe('Portuguese synthetic canonical specimen', () => {
  const sources = [
    { endings: 'LF', source: markdown.replace(/\r\n/g, '\n') },
    { endings: 'CRLF', source: markdown.replace(/\r?\n/g, '\r\n') },
  ]

  it.each(sources)('shows exactly the incorrect preview canonical followed by the intended public canonical with $endings', ({ source }) => {
    expect(canonicalSpecimen(source)).toEqual([
      'https://preview.example.test/servicos/seo-tecnico/',
      'https://www.example.test/servicos/seo-tecnico/',
    ])
  })

  it.each(sources)('keeps the sample path while removing the preview host from the corrected output with $endings', ({ source }) => {
    const [before, after] = canonicalSpecimen(source)
    expect(new URL(before).pathname).toBe('/servicos/seo-tecnico/')
    expect(new URL(after).pathname).toBe('/servicos/seo-tecnico/')
    expect(new URL(after).host).toBe('www.example.test')
    expect(after).not.toContain('preview.example.test')
  })
})
