<script lang="ts">
  import Kanji from '$lib/components/chrome/Kanji.svelte'
  import MotionHeading from '$lib/components/chrome/MotionHeading.svelte'
  import { EMAIL, JP, PAGE_COPY, PORTUGUESE_EMAIL, PT_MAILTO, MAILTO, WHATSAPP_AVAILABLE, WHATSAPP_URL } from '$lib/constants'
  import type { Locale } from '$lib/locale'

  let { locale }: { locale: Locale } = $props()

  let content = $derived(PAGE_COPY[locale].contact)
  let showWhatsapp = $derived(WHATSAPP_AVAILABLE)
  let localeMailto = $derived(locale === 'pt-BR' ? PT_MAILTO : MAILTO)
  let localeEmail = $derived(locale === 'pt-BR' ? PORTUGUESE_EMAIL : EMAIL)
</script>

<section class="editorial-subhero contact-subhero">
  <Kanji char="連絡" class="subhero-kanji" />
  <div class="subhero-grid contact-subhero__grid">
    <div class="subhero-copy">
      <p class="section-label motion-rise"><span class="font-jp">{JP.contact}</span> {content.label}</p>
      <h1 class="motion-subhero-heading"><span>{content.hero}</span><span>{content.heroAccent}</span></h1>
      <p class="motion-rise">{content.intro}</p>
      <a class="button button--solid" href={showWhatsapp ? WHATSAPP_URL : localeMailto}>{showWhatsapp ? content.whatsapp : content.bookCall} <span aria-hidden="true">→</span></a>
      <a class="subhero-copy__mail" href={localeMailto}>{showWhatsapp ? content.emailCta : localeEmail}</a>
    </div>
    <aside class="office-card">
      <p class="office-card__label"><span class="font-jp">{JP.office}</span> {content.office}</p>
      <b>Advanced Digital Marketing LTDA</b>
      <address>AV PAULISTA 777<br />ANDAR 15 CONJ 15 SALA 3408<br />SÃO PAULO, SP<br />01311-914</address>
      <span class="office-card__status">{content.status}</span>
    </aside>
  </div>
</section>

<section class="editorial-section editorial-section--paper contact-notes">
  <Kanji char="書" class="section-kanji section-kanji--right" />
  <div class="section-inner">
    <p class="section-label motion-rise"><span class="font-jp">要点</span> {content.notesLabel}</p>
    <MotionHeading class="section-heading" text={content.notesHeading} />
    <ol class="motion-wipe">{#each content.notes as [label, jp, text] (label)}<li><span><b>{label}</b><i class="font-jp">{jp}</i></span><p>{text}</p></li>{/each}</ol>
  </div>
</section>

<section class="editorial-section contact-section">
  <Kanji char={JP.seal} onRed class="section-kanji section-kanji--right" />
  <div class="section-inner">
    <p class="section-label motion-rise"><span class="font-jp">連絡</span> {content.closeLabel}</p>
    <MotionHeading class="section-heading" text={content.closeHeading} /><p class="contact-section__sub motion-rise">{content.closeLead}</p>
    <a class="hanko-cta" href={showWhatsapp ? WHATSAPP_URL : localeMailto}><span class="hanko-cta__seal font-jp-serif">{JP.seal}</span><span>{showWhatsapp ? content.whatsapp : content.bookCall} <span aria-hidden="true">→</span></span></a>
  </div>
</section>
