<script lang="ts">
  import { page } from '$app/state'
  import { saveLanguagePreference } from '$lib/client/language-preference'
  import { CHROME_COPY, localeForPath, localizedPath } from '$lib/locale'

  let locale = $derived(localeForPath(page.url.pathname))
  let copy = $derived(CHROME_COPY[locale])
  let englishPath = $derived(localizedPath(page.url.pathname, 'en-US') ?? '/')
  let portuguesePath = $derived(localizedPath(page.url.pathname, 'pt-BR') ?? '/pt-br/')

</script>

<nav class="language-switcher" aria-label={copy.languageLabel}>
  <a href={englishPath} aria-current={locale === 'en-US' ? 'true' : undefined} onclick={() => saveLanguagePreference('en-US')}>EN</a>
  <span aria-hidden="true">/</span>
  <a href={portuguesePath} aria-current={locale === 'pt-BR' ? 'true' : undefined} onclick={() => saveLanguagePreference('pt-BR')}>PT</a>
</nav>
