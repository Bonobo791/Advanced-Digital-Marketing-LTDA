<script lang="ts">
  import Kanji from '$lib/components/chrome/Kanji.svelte'
  import MotionHeading from '$lib/components/chrome/MotionHeading.svelte'
  import { EMAIL, JP, MAILTO } from '$lib/constants'
  import type { Locale } from '$lib/locale'

  let { locale }: { locale: Locale } = $props()

  const english = {
    label: 'Contact', hero: 'Open a', heroAccent: 'channel.',
    intro: 'One inbox, no intake form, no account manager. Every message lands directly with the owner.',
    bookCall: 'Book a strategy call', office: 'Registered office', status: 'Channel: open',
    notesLabel: 'Before you write', notesHeading: 'Three things that make the first reply useful.',
    notes: [
      ['Goal', JP.goal, 'What outcome you want: more qualified traffic, better conversion, a site that ranks, or all three.'],
      ['URL', JP.site, 'Your current site, if you have one. The audit starts there.'],
      ['Timeline', JP.deadline, 'When you need results by, and what a win looks like for you.'],
    ],
    closeLabel: 'Contact', closeHeading: 'The channel is open.',
    closeLead: 'Bring the visibility problem in front of you. The first reply comes straight from the person doing the work.',
  }

  const portuguese = {
    label: 'Contato', hero: 'Abra um', heroAccent: 'canal.',
    intro: 'Uma caixa de entrada, sem formulário e sem gerente de contas. Toda mensagem chega diretamente ao proprietário.',
    bookCall: 'Agende uma conversa estratégica', office: 'Sede registrada', status: 'Canal: aberto',
    notesLabel: 'Antes de escrever', notesHeading: 'Três informações que tornam a primeira resposta útil.',
    notes: [
      ['Objetivo', JP.goal, 'O resultado que você busca: mais tráfego qualificado, melhor conversão, um site que ranqueia ou tudo isso.'],
      ['URL', JP.site, 'Seu site atual, se tiver um. A auditoria começa por ele.'],
      ['Prazo', JP.deadline, 'Quando você precisa de resultados e como será uma vitória para o seu negócio.'],
    ],
    closeLabel: 'Contato', closeHeading: 'O canal está aberto.',
    closeLead: 'Traga o problema de visibilidade que está à sua frente. A primeira resposta vem diretamente de quem fará o trabalho.',
  }

  let content = $derived(locale === 'pt-BR' ? portuguese : english)
</script>

<section class="editorial-subhero contact-subhero">
  <Kanji char="連絡" class="subhero-kanji" />
  <div class="subhero-grid contact-subhero__grid">
    <div class="subhero-copy">
      <p class="section-label motion-rise"><span class="font-jp">{JP.contact}</span> {content.label}</p>
      <h1 class="motion-subhero-heading"><span>{content.hero}</span><span>{content.heroAccent}</span></h1>
      <p class="motion-rise">{content.intro}</p>
      <a class="button button--solid" href={MAILTO}>{content.bookCall} <span aria-hidden="true">→</span></a>
      <a class="subhero-copy__mail" href={MAILTO}>{EMAIL}</a>
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
    <a class="hanko-cta" href={MAILTO}><span class="hanko-cta__seal font-jp-serif">{JP.seal}</span><span>{content.bookCall} <span aria-hidden="true">→</span></span></a>
  </div>
</section>
