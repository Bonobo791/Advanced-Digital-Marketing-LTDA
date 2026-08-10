export const SITE_ORIGIN = 'https://advanceddigitalmarketingltda.com'

export const LOCALES = ['en-US', 'pt-BR'] as const
export type Locale = (typeof LOCALES)[number]

export const PAGE_IDS = ['home', 'about', 'contact'] as const
export type PageId = (typeof PAGE_IDS)[number]

export const LOCALE_ROUTES: Record<PageId, Record<Locale, string>> = {
  home: { 'en-US': '/', 'pt-BR': '/pt-br/' },
  about: { 'en-US': '/about/', 'pt-BR': '/pt-br/sobre/' },
  contact: { 'en-US': '/contact/', 'pt-BR': '/pt-br/contato/' },
}

export const PAGE_JP: Record<PageId, string> = {
  home: '先進デジタルマーケティング',
  about: '運営者',
  contact: '連絡',
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
  },
  'pt-BR': {
    home: {
      title: 'Advanced Digital Marketing LTDA | Engenharia de SEO e GEO',
      description: 'SEO, GEO, mídia de busca e engenharia web para empresas dos EUA, a partir de São Paulo.',
    },
    about: {
      title: 'Sobre Andrew Philip Weilbacher | Advanced Digital Marketing LTDA',
      description: 'Conheça Andrew Weilbacher, fundador e engenheiro-chefe da Advanced Digital Marketing LTDA.',
    },
    contact: {
      title: 'Contato | Advanced Digital Marketing LTDA',
      description: 'Fale com a Advanced Digital Marketing LTDA sobre SEO, GEO, mídia paga ou engenharia web.',
    },
  },
}

export const CHROME_COPY: Record<Locale, {
  navigation: Record<PageId, string>
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
    navigation: { home: 'Home', about: 'About', contact: 'Contact' },
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
    navigation: { home: 'Início', about: 'Sobre', contact: 'Contato' },
    navigationLabel: 'Navegação principal',
    bookCall: 'Agende uma conversa',
    menu: 'Menu',
    close: 'Fechar',
    footerSummary: 'SEO, mídia paga e engenharia web para empresas que precisam ser encontradas por pessoas e mecanismos de resposta.',
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

export function localizedPath(pathname: string, locale: Locale) {
  const page = pageForPath(pathname)
  return page ? LOCALE_ROUTES[page][locale] : undefined
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
    return { type: 'next', geoBr: country?.toUpperCase() === 'BR' }
  }

  if (normalizePath(pathname) !== '/') return { type: 'next' }
  if (language === 'pt-BR' || (!language && country?.toUpperCase() === 'BR')) {
    return { type: 'redirect', location: `${LOCALE_ROUTES.home['pt-BR']}${search}` }
  }

  return { type: 'next' }
}
