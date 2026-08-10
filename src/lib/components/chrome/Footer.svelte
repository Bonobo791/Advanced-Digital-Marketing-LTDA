<script lang="ts">
  import { page } from '$app/state'
  import { EMAIL, JP, MAILTO } from '$lib/constants'
  import { CHROME_COPY, localeForPath, navigationForLocale } from '$lib/locale'

  let locale = $derived(localeForPath(page.url.pathname))
  let copy = $derived(CHROME_COPY[locale])
  let links = $derived(navigationForLocale(locale))
</script>

<footer class="editorial-footer">
  <div class="editorial-footer__grid">
    <div class="editorial-footer__brand">
      <p class="editorial-brand"><span class="editorial-brand__seal font-jp-serif" aria-hidden="true">{JP.seal}</span> ADM//LTDA</p>
      <p>{copy.footerSummary}</p>
    </div>

    <div class="editorial-footer__links">
      <p class="footer-label"><span class="font-jp">案内</span> {copy.footerNavigate}</p>
      <ul>{#each links as link (link.to)}<li><a href={link.to}><span class="font-jp">{link.jp}</span>{link.label}</a></li>{/each}</ul>
    </div>

    <div class="editorial-footer__cta">
      <p class="footer-label"><span class="font-jp">連絡</span> {copy.footerContact}</p>
      <a href={MAILTO}>{copy.bookCall}</a><span>{EMAIL}</span>
    </div>
  </div>
  <div class="editorial-footer__base"><span>© 2026 Advanced Digital Marketing LTDA</span><span>{copy.footerBase}</span></div>
</footer>
