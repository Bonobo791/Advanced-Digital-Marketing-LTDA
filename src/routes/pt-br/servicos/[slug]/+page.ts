import { error } from '@sveltejs/kit'
import { SERVICE_IDS, resolveServiceSlug } from '$lib/services'

export const prerender = true
export const entries = () => SERVICE_IDS.map((slug) => ({ slug }))

export function load({ params }: { params: Record<string, string> }) {
  const service = resolveServiceSlug(params.slug)
  if (!service) error(404, 'Serviço não encontrado')
  return { service }
}
