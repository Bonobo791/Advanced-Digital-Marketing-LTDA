<script lang="ts">
  import { page } from '$app/state'
  import { saveLanguagePreference } from '$lib/client/language-preference'
  import { CHROME_COPY, isCheckoutPath, localeForPath, localizedPath } from '$lib/locale'

  let locale = $derived(localeForPath(page.url.pathname))
  let copy = $derived(CHROME_COPY[locale])
  let englishPath = $derived(localizedPath(page.url.pathname, 'en-US') ?? '/')
  let portuguesePath = $derived(localizedPath(page.url.pathname, 'pt-BR') ?? '/pt-br/')

  // The checkout return page exists only in pt-BR — there is no counterpart
  // to switch to. Rendering the switcher there would drop the customer out of
  // the payment-status flow and discard the preapproval_id query string.
  let hidden = $derived(isCheckoutPath(page.url.pathname))
</script>

{#if !hidden}
  <nav class="language-switcher" aria-label={copy.languageLabel}>
    <span class="language-switcher__flipper">
      <a href={englishPath} hreflang="en-US" aria-current={locale === 'en-US' ? 'true' : undefined} onclick={() => saveLanguagePreference('en-US')}>EN</a>
      <a href={portuguesePath} hreflang="pt-BR" aria-current={locale === 'pt-BR' ? 'true' : undefined} onclick={() => saveLanguagePreference('pt-BR')}>PT</a>
    </span>
  </nav>
{/if}
