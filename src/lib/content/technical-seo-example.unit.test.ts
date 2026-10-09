import { describe, expect, it } from 'vitest'
import markdown from './technical-seo-pt-br.md?raw'

// This consumes the actual published specimen, not a second copy of its HTML.
// The fictional HTTP response and account outcomes are deliberately not tested.
function canonicalSpecimen() {
  const example = markdown.split('## Exemplo sintético de uma correção verificável\n')[1]?.split(/^## /m)[0]
  const html = example?.match(/```html\r?\n([\s\S]*?)```/)?.[1]
  if (!html) throw new Error('The synthetic demonstration needs its HTML specimen')
  return [...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]+)"\s*>/g)].map((match) => match[1])
}

describe('Portuguese synthetic canonical specimen', () => {
  it('shows exactly the incorrect preview canonical followed by the intended public canonical', () => {
    expect(canonicalSpecimen()).toEqual([
      'https://preview.example.test/servicos/seo-tecnico/',
      'https://www.example.test/servicos/seo-tecnico/',
    ])
  })

  it('keeps the sample path while removing the preview host from the corrected output', () => {
    const [before, after] = canonicalSpecimen()
    expect(new URL(before).pathname).toBe('/servicos/seo-tecnico/')
    expect(new URL(after).pathname).toBe('/servicos/seo-tecnico/')
    expect(new URL(after).host).toBe('www.example.test')
    expect(after).not.toContain('preview.example.test')
  })
})
