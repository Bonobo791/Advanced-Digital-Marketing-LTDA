import { env } from '$env/dynamic/public'

export const EMAIL = 'contact@AdvancedDigitalMarketingLTDA.com'
export const PORTUGUESE_EMAIL = 'contato@AdvancedDigitalMarketingLTDA.com'
export const MAILTO = `mailto:${EMAIL}?subject=Strategy%20call%20request`
export const PT_MAILTO = `mailto:${PORTUGUESE_EMAIL}?subject=Conversa%20estrat%C3%A9gica`
export const WHATSAPP_URL = env.PUBLIC_WHATSAPP_URL?.trim() || ''

export const LINKS = [
  { to: '/', label: 'Home', jp: 'ホーム' },
  { to: '/about', label: 'About', jp: '概要' },
  { to: '/contact', label: 'Contact', jp: '連絡' },
]

export const JP = {
  brand: '先進デジタルマーケティング',
  heroRail: 'アドバンスト・デジタル・マーケティング / 答',
  seal: '答',
  platforms: '基盤',
  services: '業務',
  audit: '監査',
  build: '構築',
  compound: '複利',
  operator: '運営者',
  contact: '連絡',
  office: '所在地',
  navigate: '案内',
  goal: '目的',
  site: 'サイト',
  deadline: '期限',
} as const
