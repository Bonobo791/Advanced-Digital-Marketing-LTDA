import { BLOG_ARTICLES } from '$lib/server/blog'

export function load() {
  // The index renders only cards — keep the rendered article HTML out of the
  // page data payload.
  return {
    articles: BLOG_ARTICLES.map((article) => ({
      slug: article.slug,
      title: article.title,
      description: article.description,
      published: article.published,
    })),
  }
}
