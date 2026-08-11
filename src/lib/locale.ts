export const SITE_ORIGIN = 'https://advanceddigitalmarketingltda.com'

export const LOCALES = ['en-US', 'pt-BR'] as const
export type Locale = (typeof LOCALES)[number]

export const PAGE_IDS = ['home', 'about', 'contact', 'pricing'] as const
export type PageId = (typeof PAGE_IDS)[number]

export const LOCALE_ROUTES: Record<PageId, Record<Locale, string>> = {
  home: { 'en-US': '/', 'pt-BR': '/pt-br/' },
  about: { 'en-US': '/about/', 'pt-BR': '/pt-br/sobre/' },
  contact: { 'en-US': '/contact/', 'pt-BR': '/pt-br/contato/' },
  pricing: { 'en-US': '/pricing/', 'pt-BR': '/pt-br/precos/' },
}

export const PAGE_JP: Record<PageId, string> = {
  home: '先進デジタルマーケティング',
  about: '運営者',
  contact: '連絡',
  pricing: '料金',
}

export const PAGE_META: Record<Locale, Record<PageId, { title: string; description: string }>> = {
  'en-US': {
    home: {
      title: 'Advanced Digital Marketing LTDA | SEO and GEO engineering',
      description: 'SEO, GEO, paid search, and web engineering for US businesses from São Paulo.',
    },
    about: {
      title: 'About Andrew Philip Weilbacher | Advanced Digital Marketing LTDA',
      description: 'Meet Andrew Weilbacher, founder and lead engineer at Advanced Digital Marketing LTDA.',
    },
    contact: {
      title: 'Contact | Advanced Digital Marketing LTDA',
      description: 'Contact Advanced Digital Marketing LTDA to discuss SEO, GEO, paid media, or web engineering.',
    },
    pricing: {
      title: 'Pricing | Advanced Digital Marketing LTDA',
      description: 'One-time project pricing for SEO, GEO, paid media, and web engineering from Advanced Digital Marketing LTDA.',
    },
  },
  'pt-BR': {
    home: {
      title: 'Advanced Digital Marketing LTDA | SEO local e visibilidade em respostas de IA',
      description: 'Engenharia de busca para empresas brasileiras que precisam ser encontradas no Google, no Maps e nas respostas de IA.',
    },
    about: {
      title: 'Sobre Andrew Philip Weilbacher | Engenharia de busca em São Paulo',
      description: 'Conheça o fundador e engenheiro-chefe por trás de SEO local, sites, GEO e mídia paga para empresas brasileiras.',
    },
    contact: {
      title: 'Contato | SEO local e visibilidade em IA',
      description: 'Fale sobre como sua empresa pode aparecer no Google, no Maps e nas respostas de IA.',
    },
    pricing: {
      title: 'Preços | Advanced Digital Marketing LTDA',
      description: 'Investimento em projetos de SEO, GEO, mídia paga e desenvolvimento web da Advanced Digital Marketing LTDA.',
    },
  },
}

export const CHROME_COPY: Record<Locale, {
  navigation: Record<PageId, string>
  services: string
  navigationLabel: string
  bookCall: string
  menu: string
  close: string
  footerSummary: string
  footerNavigate: string
  footerContact: string
  footerBase: string
  footerTagline: string
  languageLabel: string
}> = {
  'en-US': {
    navigation: { home: 'Home', about: 'About', contact: 'Contact', pricing: 'Pricing' },
    services: 'Services',
    navigationLabel: 'Primary navigation',
    bookCall: 'Book a call',
    menu: 'Menu',
    close: 'Close',
    footerSummary: 'Search, paid media, and web engineering for businesses that need to be found by people and answer engines alike.',
    footerNavigate: 'Navigate',
    footerContact: 'Contact',
    footerBase: 'CNPJ 68.425.709/0001-72 · São Paulo, Brazil',
    footerTagline: 'SEO / GEO engineering',
    languageLabel: 'Language',
  },
  'pt-BR': {
    navigation: { home: 'Início', about: 'Sobre', contact: 'Contato', pricing: 'Preços' },
    services: 'Serviços',
    navigationLabel: 'Navegação principal',
    bookCall: 'Agende uma conversa',
    menu: 'Menu',
    close: 'Fechar',
    footerSummary: 'SEO, mídia paga e engenharia web para empresas que precisam ser encontradas por pessoas e respostas de IA.',
    footerNavigate: 'Navegue',
    footerContact: 'Contato',
    footerBase: 'CNPJ 68.425.709/0001-72 · São Paulo, Brasil',
    footerTagline: 'Engenharia de SEO / GEO',
    languageLabel: 'Idioma',
  },
}

export function normalizePath(pathname: string) {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  return path === '/' ? path : path.replace(/\/+$/, '')
}

export function pageForPath(pathname: string): PageId | undefined {
  const normalized = normalizePath(pathname)

  return PAGE_IDS.find((page) =>
    LOCALES.some((locale) => normalizePath(LOCALE_ROUTES[page][locale]) === normalized),
  )
}

export function localeForPath(pathname: string): Locale {
  const normalized = normalizePath(pathname)
  return normalized === '/pt-br' || normalized.startsWith('/pt-br/') ? 'pt-BR' : 'en-US'
}

import { SERVICE_ROUTES, serviceForPath } from './services'

export function localizedPath(pathname: string, locale: Locale) {
  const page = pageForPath(pathname)
  if (page) return LOCALE_ROUTES[page][locale]
  const service = serviceForPath(pathname)
  return service ? SERVICE_ROUTES[service][locale] : undefined
}

export function absoluteUrl(pathname: string) {
  return new URL(pathname, SITE_ORIGIN).toString()
}

export function navigationForLocale(locale: Locale) {
  return PAGE_IDS.map((page) => ({
    to: LOCALE_ROUTES[page][locale],
    label: CHROME_COPY[locale].navigation[page],
    jp: PAGE_JP[page],
  }))
}

export function homeSectionsForLocale(locale: Locale) {
  return locale === 'pt-BR'
    ? [
        { to: '/pt-br/#services', label: 'Serviços', jp: 'サービス' },
        { to: '/pt-br/#process', label: 'Processo', jp: '工程' },
        { to: '/pt-br/#why', label: 'Por que nós', jp: '強み' },
        { to: '/pt-br/#people', label: 'Pessoas', jp: '人' },
        { to: '/pt-br/#contact', label: 'Contato', jp: '連絡' },
      ]
    : [
        { to: '/#services', label: 'Services', jp: 'サービス' },
        { to: '/#process', label: 'Process', jp: '工程' },
        { to: '/#why', label: 'Why us', jp: '強み' },
        { to: '/#people', label: 'People', jp: '人' },
        { to: '/#contact', label: 'Contact', jp: '連絡' },
      ]
}

export function browserPrefersPortuguese(languages: readonly string[]) {
  return languages.some((language) => language.toLowerCase().startsWith('pt'))
}

type LocaleRequest = {
  method: string
  pathname: string
  search: string
  language?: string
  country?: string
}

export type LocaleDecision =
  | { type: 'redirect'; location: string }
  | { type: 'next'; geoBr?: boolean }

export function decideLocaleRequest({ method, pathname, search, language, country }: LocaleRequest): LocaleDecision {
  if (method !== 'GET' && method !== 'HEAD') return { type: 'next' }
  if (localeForPath(pathname) === 'pt-BR') return { type: 'next' }

  const page = pageForPath(pathname)
  if (page && page !== 'home') {
    return { type: 'next', geoBr: language !== 'en-US' && country?.toUpperCase() === 'BR' }
  }

  if (normalizePath(pathname) !== '/') return { type: 'next' }
  if (language === 'pt-BR') {
    return { type: 'redirect', location: `${LOCALE_ROUTES.home['pt-BR']}${search}` }
  }

  return { type: 'next', geoBr: language !== 'en-US' && country?.toUpperCase() === 'BR' }
}
