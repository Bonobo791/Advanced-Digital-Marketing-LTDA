<script lang="ts">
  import { browser } from '$app/environment'
  import { page } from '$app/state'
  import { saveLanguagePreference } from '$lib/client/language-preference'
  import { browserPrefersPortuguese, localeForPath, localizedPath, pageForPath } from '$lib/locale'

  const dismissedKey = 'adm-language-suggestion-dismissed'

  let visible = $state(false)
  let message = $state('')
  let destination = $derived(localizedPath(page.url.pathname, 'pt-BR'))

  $effect(() => {
    if (!browser) return

    visible = false
    const pageId = pageForPath(page.url.pathname)
    if (localeForPath(page.url.pathname) === 'pt-BR' || !pageId || pageId === 'home' || !destination) return
    if (sessionStorage.getItem(dismissedKey)) return

    const language = document.cookie.match(/(?:^|; )language=([^;]+)/)?.[1]
    const inBrazil = /(?:^|; )geo_br=1(?:;|$)/.test(document.cookie)
    const languages = navigator.languages.length ? navigator.languages : [navigator.language]

    if (inBrazil) message = 'Você está no Brasil. Veja esta página em português.'
    else if (language === 'pt-BR' || browserPrefersPortuguese(languages)) message = 'Veja esta página em português.'
    else return

    visible = true
  })

  function dismiss() {
    sessionStorage.setItem(dismissedKey, '1')
    visible = false
  }
</script>

{#if visible && destination}
  <aside class="language-suggestion" aria-label="Sugestão de idioma">
    <span>{message}</span>
    <a href={destination} onclick={() => saveLanguagePreference('pt-BR')}>Ver em português <span aria-hidden="true">→</span></a>
    <button type="button" aria-label="Fechar sugestão de idioma" onclick={dismiss}>×</button>
  </aside>
{/if}
