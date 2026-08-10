<script lang="ts">
  import Kanji from '$lib/components/chrome/Kanji.svelte'
  import MotionHeading from '$lib/components/chrome/MotionHeading.svelte'
  import { EMAIL, JP, PORTUGUESE_EMAIL, PT_MAILTO, MAILTO, WHATSAPP_URL } from '$lib/constants'
  import type { Locale } from '$lib/locale'

  let { locale }: { locale: Locale } = $props()

  const english = {
    label: 'Contact', hero: 'Open a', heroAccent: 'channel.',
    intro: 'One inbox, no intake form, no account manager. Every message lands directly with the owner.',
    bookCall: 'Book a strategy call', whatsapp: 'Book via WhatsApp', emailCta: EMAIL, office: 'Registered office', status: 'Channel: open',
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
    bookCall: 'Agendar uma conversa por e-mail', office: 'Sede registrada', status: 'Canal: aberto',
    notesLabel: 'Antes de escrever', notesHeading: 'Cinco informações que tornam a primeira resposta útil.',
    notes: [
      ['O que você vende?', JP.goal, 'Conte qual é sua oferta principal e o que você quer que mais pessoas encontrem.'],
      ['Em quais cidades atende?', JP.site, 'Liste as cidades e regiões onde você quer gerar contatos.'],
      ['Qual serviço precisa gerar mais contatos?', JP.deadline, 'Aponte o serviço que deve receber mais procura qualificada.'],
      ['Você já usa Google Perfil da Empresa, anúncios ou uma landing page?', JP.goal, 'Conte quais canais já estão ativos e o que está funcionando hoje.'],
      ['Quando precisa começar a ver evolução?', JP.site, 'Indique o prazo que orienta sua prioridade de implementação.'],
    ],
    closeLabel: 'Contato', closeHeading: 'O canal está aberto.',
    closeLead: 'Conte o que você vende, onde atende e o que precisa melhorar. A primeira resposta vem diretamente de quem vai analisar o trabalho.',
    whatsapp: 'Falar pelo WhatsApp', emailCta: 'Enviar um e-mail',
  }

  let content = $derived(locale === 'pt-BR' ? portuguese : english)
  let showWhatsapp = $derived(locale === 'pt-BR' && Boolean(WHATSAPP_URL))
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
