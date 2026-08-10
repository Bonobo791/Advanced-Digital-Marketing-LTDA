import type { Locale } from '$lib/locale'

export function saveLanguagePreference(language: Locale) {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `language=${language}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
}
