import { describe, expect, it } from 'vitest'
import { BLOG_ARTICLES, CHATGPT_ADS_ARTICLE } from './blog'

describe('blog content', () => {
  it('publishes the ChatGPT Ads guide with linked inline citations', () => {
    expect(BLOG_ARTICLES).toHaveLength(1)
    expect((CHATGPT_ADS_ARTICLE.html.match(/class="blog-citation"/g) ?? [])).toHaveLength(20)
    expect(CHATGPT_ADS_ARTICLE.html).toContain('https://openai.com/policies/ad-policies/')
    expect(CHATGPT_ADS_ARTICLE.html).not.toContain('Publishing Appendix')
    expect(CHATGPT_ADS_ARTICLE.html).not.toContain('## Sources')
    expect(CHATGPT_ADS_ARTICLE.html).not.toContain('[^1]')
  })
})
