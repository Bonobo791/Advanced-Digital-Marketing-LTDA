import { error } from '@sveltejs/kit'
import { resolveServiceSlug } from '$lib/services'
import type { PageServerData } from './$types'

export function load({ params, data }: { params: Record<string, string>; data: PageServerData }) {
  const service = resolveServiceSlug(params.slug)
  if (!service) error(404, 'Serviço não encontrado')
  return { ...data, service }
}
