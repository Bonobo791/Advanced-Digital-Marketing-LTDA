import { loadTechnicalSeoPage } from '$lib/server/technical-seo'

export function load({ params }: { params: Record<string, string> }) {
  return loadTechnicalSeoPage('en-US', params.slug)
}
