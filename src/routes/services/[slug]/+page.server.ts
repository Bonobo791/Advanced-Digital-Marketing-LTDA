import { TECHNICAL_SEO_CONTENT } from '$lib/server/technical-seo'
import { resolveServiceSlug } from '$lib/services'

export function load({ params }: { params: Record<string, string> }) {
  return {
    technicalSeo: resolveServiceSlug(params.slug) === 'technical-seo' ? TECHNICAL_SEO_CONTENT : null,
  }
}
