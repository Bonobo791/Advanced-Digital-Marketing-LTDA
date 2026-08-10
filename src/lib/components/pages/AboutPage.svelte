<script lang="ts">
  import portrait from '$lib/assets/andrew-new.jpg'
  import Kanji from '$lib/components/chrome/Kanji.svelte'
  import MotionHeading from '$lib/components/chrome/MotionHeading.svelte'
  import { JP, MAILTO, PT_MAILTO, WHATSAPP_URL } from '$lib/constants'
  import type { Locale } from '$lib/locale'

  let { locale }: { locale: Locale } = $props()

  const english = {
    operator: 'The operator',
    hero: 'Founder and operator of Advanced Digital Marketing LTDA. SEO engineer, web developer, and paid media practitioner.',
    portraitAlt: 'Portrait of Andrew Philip Weilbacher',
    background: 'Background',
    heading: 'One person, full stack, two markets.',
    story: [
      'Andrew was born in the United States, built his early career between Pennsylvania and Florida, and now runs his agency from São Paulo, Brazil. Advanced Digital Marketing LTDA is a CNPJ-registered Brazilian company serving clients on both sides of the border.',
      'His background is technical: search infrastructure, machine-learning-assisted ranking research, and agent-assisted web development. Strategy, implementation, and measurement come from the same desk.',
      "The agency's edge is GEO: optimizing not only for Google's classic results, but for the AI answer engines that increasingly decide which businesses get mentioned at all.",
    ],
    capabilities: 'Capabilities',
    capabilitiesHeading: 'The work stays connected.',
    capabilityGroups: [
      ['Search', 'Technical SEO', 'GEO and AI answer optimization', 'Topical authority mapping', 'Structured data'],
      ['Media', 'Google Ads', 'Meta and LinkedIn', 'Creative testing systems'],
      ['Build', 'Web design and development', 'Modern headless stacks', 'Core Web Vitals', 'Analytics and measurement'],
    ],
    facts: [['Base', 'São Paulo, BR'], ['Markets', 'US + Brazil'], ['Structure', 'Owner-operated'], ['Entity', 'LTDA, CNPJ-registered']],
    contactHeading: 'Work with the person who does the work.',
    bookCall: 'Book a strategy call', whatsapp: 'Book via WhatsApp',
  }

  const portuguese = {
    operator: 'O operador',
    hero: 'Fundador e operador da Advanced Digital Marketing LTDA. Engenheiro de SEO técnico e local, desenvolvedor web, especialista em GEO e mídia paga.',
    portraitAlt: 'Retrato de Andrew Philip Weilbacher',
    background: 'Trajetória',
    heading: 'Uma operação brasileira, da estratégia ao código.',
    story: [
      'Andrew é fundador e engenheiro-chefe da Advanced Digital Marketing LTDA, empresa brasileira registrada no CNPJ e operada a partir de São Paulo.',
      'Sua atuação combina SEO técnico e local, sites, GEO e aquisição paga — com estratégia, implementação e medição na mesma mesa.',
      'Você fala diretamente com quem analisa e executa o trabalho. Sem repasse para gerente de contas e sem separar busca, site e mídia em planos desconectados.',
    ],
    capabilities: 'Capacidades',
    capabilitiesHeading: 'O trabalho permanece conectado.',
    capabilityGroups: [
      ['Busca', 'SEO técnico e local', 'Visibilidade em respostas de IA (GEO)', 'Google Perfil da Empresa', 'Dados estruturados e páginas de serviço'],
      ['Mídia', 'Google Ads', 'Meta', 'Aquisição alinhada a conversões'],
      ['Desenvolvimento', 'Sites e landing pages', 'Performance mobile-first', 'Core Web Vitals', 'Analytics e medição'],
    ],
    facts: [['Base', 'São Paulo, BR'], ['Mercado', 'Empresas brasileiras'], ['Estrutura', 'Operação direta'], ['Empresa', 'LTDA, registrada no CNPJ']],
    contactHeading: 'Trabalhe com quem executa o trabalho.',
    bookCall: 'Agende uma conversa', whatsapp: 'Falar pelo WhatsApp',
  }

  let content = $derived(locale === 'pt-BR' ? portuguese : english)
  let showWhatsapp = $derived(locale === 'pt-BR' && Boolean(WHATSAPP_URL))
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
    <a class="hanko-cta" href={showWhatsapp ? WHATSAPP_URL : locale === 'pt-BR' ? PT_MAILTO : MAILTO}><span class="hanko-cta__seal font-jp-serif">{JP.seal}</span><span>{showWhatsapp ? content.whatsapp : content.bookCall} <span aria-hidden="true">→</span></span></a>
  </div>
</section>
