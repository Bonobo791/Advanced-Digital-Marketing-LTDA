<script lang="ts">
  import portrait from '$lib/assets/andrew-portrait-v3-full.png'
  import Kanji from '$lib/components/chrome/Kanji.svelte'
  import MotionHeading from '$lib/components/chrome/MotionHeading.svelte'
  import { JP, MAILTO, PAGE_COPY, PT_MAILTO, WHATSAPP_AVAILABLE, WHATSAPP_URL } from '$lib/constants'
  import type { Locale } from '$lib/locale'

  let { locale }: { locale: Locale } = $props()

  let content = $derived(PAGE_COPY[locale].about)
  let showWhatsapp = $derived(WHATSAPP_AVAILABLE)
  let localeMailto = $derived(locale === 'pt-BR' ? PT_MAILTO : MAILTO)
  let ctaHref = $derived(showWhatsapp ? WHATSAPP_URL : localeMailto)
  let ctaLabel = $derived(showWhatsapp ? content.whatsapp : content.bookCall)
</script>

<section class="editorial-subhero">
  <Kanji char="人" class="subhero-kanji" />
  <div class="subhero-grid">
    <div class="subhero-copy">
      <p class="section-label motion-rise"><span class="font-jp">{JP.operator}</span> {content.operator}</p>
      <h1 class="motion-subhero-heading"><span>Andrew</span><span>Philip</span><span>Weilbacher</span></h1>
      <p class="motion-rise">{content.hero}</p>
    </div>
      <figure class="subhero-portrait"><img src={portrait} alt={content.portraitAlt} width="1024" height="1440" fetchpriority="high" /></figure>
  </div>
</section>

<section class="editorial-section editorial-section--paper about-story">
  <div class="section-inner about-story__grid">
    <div><p class="section-label motion-rise"><span class="font-jp">経歴</span> {content.background}</p><MotionHeading class="section-heading" text={content.heading} /></div>
    <div class="about-story__copy motion-rise">{#each content.story as paragraph (paragraph)}<p>{paragraph}</p>{/each}</div>
  </div>
</section>

<section class="editorial-section about-capabilities">
  <Kanji char="構築" class="section-kanji section-kanji--right" />
  <div class="section-inner">
    <p class="section-label motion-rise"><span class="font-jp">構築</span> {content.capabilities}</p>
    <MotionHeading class="section-heading" text={content.capabilitiesHeading} />
    <div class="capability-list motion-wipe">
      {#each content.capabilityGroups as [group, ...items] (group)}
        <section><h3>{group}</h3><ul>{#each items as item (item)}<li>{item}</li>{/each}</ul></section>
      {/each}
    </div>
  </div>
</section>

<section class="facts-strip">
  {#each content.facts as [label, value] (label)}<div class="motion-rise"><span>{label}</span><b>{value}</b></div>{/each}
</section>

<section class="editorial-section contact-section contact-section--compact">
  <Kanji char={JP.seal} onRed class="section-kanji section-kanji--right" />
  <div class="section-inner">
    <MotionHeading class="section-heading" text={content.contactHeading} />
    <a class="hanko-cta" href={ctaHref}><span class="hanko-cta__seal font-jp-serif">{JP.seal}</span><span>{ctaLabel} <span aria-hidden="true">→</span></span></a>
  </div>
</section>
