<script lang="ts">
  import Kanji from '$lib/components/chrome/Kanji.svelte'
  import MotionHeading from '$lib/components/chrome/MotionHeading.svelte'
  import { JP, PAGE_COPY } from '$lib/constants'
  import type { Locale } from '$lib/locale'
  import ContactForm from './ContactForm.svelte'

  let { locale }: { locale: Locale } = $props()

  let content = $derived(PAGE_COPY[locale].contact)
</script>

<section class="editorial-subhero contact-subhero">
  <Kanji char="連絡" class="subhero-kanji" />
  <div class="subhero-grid contact-subhero__grid">
    <div class="subhero-copy">
      <p class="section-label motion-rise"><span class="font-jp">{JP.contact}</span> {content.label}</p>
      <h1 class="motion-subhero-heading"><span>{content.hero}</span><span>{content.heroAccent}</span></h1>
      <p class="motion-rise">{content.intro}</p>
      <a class="button button--solid motion-rise" href="#contact-form">{content.formCta} <span aria-hidden="true">→</span></a>
    </div>
    <aside class="office-card">
      <p class="office-card__label"><span class="font-jp">{JP.office}</span> {content.office}</p>
      <b>Advanced Digital Marketing LTDA</b>
      <address>AV PAULISTA 777<br />ANDAR 15 CONJ 15 SALA 3408<br />SÃO PAULO, SP<br />01311-914</address>
      <span class="office-card__status">{content.status}</span>
    </aside>
  </div>
</section>

<section class="editorial-section editorial-section--paper contact-form-section">
  <Kanji char="書" class="section-kanji section-kanji--right" />
  <div class="section-inner">
    <p class="section-label motion-rise"><span class="font-jp">連絡</span> {content.formLabel}</p>
    <MotionHeading class="section-heading" text={content.formHeading} />
    <p class="contact-form-section__lead motion-rise">{content.formLead}</p>

    <div class="contact-form-grid">
      <div id="contact-form" class="contact-form-grid__form motion-rise">
        <ContactForm {locale} />
      </div>
      <aside class="contact-notes contact-form-grid__notes motion-wipe">
        <p class="section-label"><span class="font-jp">順序</span> {content.notesLabel}</p>
        <h3 class="contact-form-grid__notes-title">{content.notesHeading}</h3>
        <ol>{#each content.notes as [label, jp, text] (label)}<li><span><b>{label}</b><i class="font-jp">{jp}</i></span><p>{text}</p></li>{/each}</ol>
      </aside>
    </div>
  </div>
</section>
