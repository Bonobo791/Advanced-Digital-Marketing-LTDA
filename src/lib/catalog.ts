/**
 * Subscription service catalog — the single source of truth for what can be
 * subscribed to and what it costs.
 *
 * Isomorphic (safe to import on server and client): it contains no secrets.
 * The client uses it only to DISPLAY prices; the authoritative total is always
 * recomputed server-side by `src/lib/server/pricing.ts`. Never accept a
 * client-supplied total as authoritative.
 */
import type { Locale } from '$lib/locale'

export const SERVICE_IDS = [
  'seo-content',
  'backlinks',
  'hosting',
  'paid-search',
  'meta-ads',
  'ai-automation',
] as const
export type ServiceId = (typeof SERVICE_IDS)[number]

/**
 * Paid-ads management rule (spec §2): the monthly management fee for an ads
 * service is `max(monthlyAdSpend × rate, minimum)`. The minimum is R$ 500
 * (US$ 100 reference) and the fee is always recomputed on the server.
 */
export const ADS_SPEND_RULE = {
  rate: 0.1,
  minimumBRL: 500,
  minimumUSD: 100,
} as const

export type ServicePricing =
  | { kind: 'fixed'; monthlyBRL: number; monthlyUSD?: number }
  | { kind: 'ads-spend' }
  | { kind: 'quote' }

export type CatalogService = {
  id: ServiceId
  name: Record<Locale, string>
  description: Record<Locale, string>
  /** BRL is authoritative for checkout; USD is a display reference only. */
  pricing: ServicePricing
  active: boolean
}

export const SERVICES: Record<ServiceId, CatalogService> = {
  'seo-content': {
    id: 'seo-content',
    name: { 'en-US': 'SEO Content', 'pt-BR': 'Conteúdo SEO' },
    description: {
      'en-US':
        'Answer-first pages, articles and service copy written to get you quoted by search engines and AI answers.',
      'pt-BR':
        'Páginas, artigos e copy orientados a respostas, escritos para você ser citado por buscadores e respostas de IA.',
    },
    pricing: { kind: 'fixed', monthlyBRL: 2000, monthlyUSD: 400 },
    active: true,
  },
  backlinks: {
    id: 'backlinks',
    name: { 'en-US': 'Backlinks', 'pt-BR': 'Backlinks' },
    description: {
      'en-US':
        'Authority earned from sites that matter, with the source and the rationale reported for every placement.',
      'pt-BR':
        'Autoridade conquistada em sites relevantes, com a fonte e a justificativa reportadas para cada inserção.',
    },
    pricing: { kind: 'fixed', monthlyBRL: 3000, monthlyUSD: 600 },
    active: true,
  },
  hosting: {
    id: 'hosting',
    name: { 'en-US': 'Hosting', 'pt-BR': 'Hospedagem' },
    description: {
      'en-US': 'Hosting with maintenance and site changes included, every month.',
      'pt-BR': 'Hospedagem com manutenção e alterações no site incluídas, todo mês.',
    },
    pricing: { kind: 'fixed', monthlyBRL: 750, monthlyUSD: 150 },
    active: true,
  },
  'paid-search': {
    id: 'paid-search',
    name: { 'en-US': 'Google Ads Management', 'pt-BR': 'Gestão de Google Ads' },
    description: {
      'en-US':
        'Google Ads managed against the same keyword map as your organic strategy. Fee: 10% of monthly ad spend, R$ 500 minimum.',
      'pt-BR':
        'Google Ads gerenciado contra o mesmo mapa de palavras-chave da sua estratégia orgânica. Mensalidade: 10% do investimento mensal em anúncios, mínimo de R$ 500.',
    },
    pricing: { kind: 'ads-spend' },
    active: true,
  },
  'meta-ads': {
    id: 'meta-ads',
    name: { 'en-US': 'Meta Ads Management', 'pt-BR': 'Gestão de Meta Ads' },
    description: {
      'en-US':
        'Facebook and Instagram campaigns managed against the same conversion data as your organic strategy. Fee: 10% of monthly ad spend, R$ 500 minimum.',
      'pt-BR':
        'Campanhas no Facebook e Instagram gerenciadas contra os mesmos dados de conversão da sua estratégia orgânica. Mensalidade: 10% do investimento mensal, mínimo de R$ 500.',
    },
    pricing: { kind: 'ads-spend' },
    active: true,
  },
  'ai-automation': {
    id: 'ai-automation',
    name: { 'en-US': 'AI Automation', 'pt-BR': 'Automação com IA' },
    description: {
      'en-US':
        'AI automation and workflow engineering, scoped and quoted per project.',
      'pt-BR':
        'Automação com IA e engenharia de fluxos de trabalho, escopadas e orçadas sob consulta.',
    },
    pricing: { kind: 'quote' },
    active: true,
  },
}

export function isServiceId(value: unknown): value is ServiceId {
  return typeof value === 'string' && (SERVICE_IDS as readonly string[]).includes(value)
}

export function getService(id: string): CatalogService | undefined {
  return SERVICES[id as ServiceId]
}

/** A service can be included in checkout when it is active and not quote-only. */
export function isSubscribable(service: CatalogService): boolean {
  return service.active && service.pricing.kind !== 'quote'
}

/**
 * Monthly management fee for an ads service, in BRL:
 * `max(monthlyAdSpend × 10%, R$ 500)`, rounded to cents.
 */
export function adSpendFeeBRL(monthlyAdSpend: number): number {
  const fee = Math.max(monthlyAdSpend * ADS_SPEND_RULE.rate, ADS_SPEND_RULE.minimumBRL)
  return Math.round(fee * 100) / 100
}

const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function formatBRL(value: number): string {
  return brlFormatter.format(value)
}

export function formatUSD(value: number): string {
  return usdFormatter.format(value)
}
