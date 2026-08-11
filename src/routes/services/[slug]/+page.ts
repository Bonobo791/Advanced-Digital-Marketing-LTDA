import { error } from '@sveltejs/kit'
import { SERVICE_IDS, type ServiceId } from '$lib/services'

export const prerender = true
export const entries = () => SERVICE_IDS.map((slug) => ({ slug }))

export function load({ params }: { params: Record<string, string> }) {
  const service = params.slug as ServiceId
  if (!SERVICE_IDS.includes(service)) error(404, 'Service not found')
  return { service }
}
