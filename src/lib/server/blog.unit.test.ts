import { describe, expect, it } from 'vitest'
import { BLOG_ARTICLES, CHATGPT_ADS_ARTICLE } from './blog'

describe('blog content', () => {
  it('publishes the ChatGPT Ads guide with linked inline citations', () => {
    expect(BLOG_ARTICLES).toHaveLength(1)
    expect((CHATGPT_ADS_ARTICLE.html.match(/class="blog-citation"/g) ?? [])).toHaveLength(20)
    expect(CHATGPT_ADS_ARTICLE.html).toContain('https://openai.com/policies/ad-policies/')
  })

  it('derives article metadata from the Markdown frontmatter', () => {
    expect(CHATGPT_ADS_ARTICLE.title).toBe(
      "ChatGPT Ads: The Complete Guide to OpenAI's Advertising Platform (August 21, 2026)",
    )
    expect(CHATGPT_ADS_ARTICLE.metaTitle).toBe('ChatGPT Ads Guide 2026: Pricing, Formats, Targeting & New Features')
    expect(CHATGPT_ADS_ARTICLE.published).toBe('2026-08-21')
    expect(CHATGPT_ADS_ARTICLE.updated).toBe('2026-08-21')
    expect(CHATGPT_ADS_ARTICLE.description).toContain('pricing')
  })

  it('strips the frontmatter and the internal publishing appendix', () => {
    // Frontmatter keys must never leak into the rendered article.
    expect(CHATGPT_ADS_ARTICLE.html).not.toContain('meta_description')
    expect(CHATGPT_ADS_ARTICLE.html).not.toContain('primary_entity')
    expect(CHATGPT_ADS_ARTICLE.html).not.toContain('Publishing Appendix')
    // The separator before the appendix must be stripped with it — the public
    // article must not end on an empty divider.
    expect(CHATGPT_ADS_ARTICLE.html.trimEnd()).not.toMatch(/<hr\s*\/?>$/)
  })
})
