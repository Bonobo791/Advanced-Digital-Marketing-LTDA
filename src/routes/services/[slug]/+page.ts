import { error } from '@sveltejs/kit'
import { resolveServiceSlug } from '$lib/services'

export function load({ params }: { params: Record<string, string> }) {
  const service = resolveServiceSlug(params.slug)
  if (!service) error(404, 'Service not found')
  return { service }
}
