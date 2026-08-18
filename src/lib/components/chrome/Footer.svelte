<script lang="ts">
  import { page } from '$app/state'
  import { JP } from '$lib/constants'
  import { CHROME_COPY, homeSectionsForLocale, localeForPath, LOCALE_ROUTES } from '$lib/locale'

  let locale = $derived(localeForPath(page.url.pathname))
  let copy = $derived(CHROME_COPY[locale])
  let links = $derived(homeSectionsForLocale(locale).slice(0, 4))
</script>

<footer class="editorial-footer">
  <div class="editorial-footer__grid">
    <div class="editorial-footer__brand">
      <p class="editorial-brand"><span class="editorial-brand__seal font-jp" aria-hidden="true">{JP.seal}</span> ADM</p>
      <p>Advanced Digital Marketing LTDA<br />CNPJ 68.425.709/0001-72<br />{locale === 'pt-BR' ? 'São Paulo, Brasil' : 'São Paulo, Brazil'}</p>
    </div>

    <div class="editorial-footer__links">
      <ul>{#each links as link (link.to)}<li><a href={link.to}><span class="font-jp">{link.jp}</span>{link.label}</a></li>{/each}</ul>
    </div>

    <div class="editorial-footer__cta">
      <a href={LOCALE_ROUTES.contact[locale]}>{copy.bookCall}</a>
    </div>
  </div>
  <div class="editorial-footer__base"><span>© 2026 Advanced Digital Marketing LTDA</span><span class="font-jp">検索の未来を、設計する。</span></div>
</footer>
