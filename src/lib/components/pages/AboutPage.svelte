<script lang="ts">
  import portrait from '$lib/assets/andrew-portrait-v3-full.png'
  import Kanji from '$lib/components/chrome/Kanji.svelte'
  import MotionHeading from '$lib/components/chrome/MotionHeading.svelte'
  import { JP, MAILTO } from '$lib/constants'
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
    bookCall: 'Book a strategy call',
  }

  const portuguese = {
    operator: 'O operador',
    hero: 'Fundador e operador da Advanced Digital Marketing LTDA. Engenheiro de SEO, desenvolvedor web e especialista em mídia paga.',
    portraitAlt: 'Retrato de Andrew Philip Weilbacher',
    background: 'Trajetória',
    heading: 'Uma pessoa, full stack, dois mercados.',
    story: [
      'Andrew nasceu nos Estados Unidos, construiu o início da carreira entre a Pensilvânia e a Flórida e hoje dirige sua agência a partir de São Paulo, Brasil. A Advanced Digital Marketing LTDA é uma empresa brasileira registrada no CNPJ que atende clientes dos dois lados da fronteira.',
      'Sua base é técnica: infraestrutura de busca, pesquisa de ranking assistida por aprendizado de máquina e desenvolvimento web assistido por agentes. Estratégia, implementação e medição vêm da mesma mesa.',
      'O diferencial da agência é GEO: otimizar não apenas para os resultados clássicos do Google, mas também para os mecanismos de resposta de IA que decidem cada vez mais quais empresas serão mencionadas.',
    ],
    capabilities: 'Capacidades',
    capabilitiesHeading: 'O trabalho permanece conectado.',
    capabilityGroups: [
      ['Busca', 'SEO técnico', 'GEO e otimização para respostas de IA', 'Mapeamento de autoridade temática', 'Dados estruturados'],
      ['Mídia', 'Google Ads', 'Meta e LinkedIn', 'Sistemas de testes criativos'],
      ['Desenvolvimento', 'Design e desenvolvimento web', 'Stacks headless modernas', 'Core Web Vitals', 'Analytics e medição'],
    ],
    facts: [['Base', 'São Paulo, BR'], ['Mercados', 'EUA + Brasil'], ['Estrutura', 'Operação direta'], ['Empresa', 'LTDA, registrada no CNPJ']],
    contactHeading: 'Trabalhe com quem realmente executa o trabalho.',
    bookCall: 'Agende uma conversa estratégica',
  }

  let content = $derived(locale === 'pt-BR' ? portuguese : english)
</script>

<section class="editorial-subhero">
  <Kanji char="人" class="subhero-kanji" />
  <div class="subhero-grid">
    <div class="subhero-copy">
      <p class="section-label motion-rise"><span class="font-jp">{JP.operator}</span> {content.operator}</p>
      <h1 class="motion-subhero-heading"><span>Andrew</span><span>Philip</span><span>Weilbacher</span></h1>
      <p class="motion-rise">{content.hero}</p>
    </div>
    <figure class="subhero-portrait"><img src={portrait} alt={content.portraitAlt} width="552" height="828" fetchpriority="high" /></figure>
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
    <a class="hanko-cta" href={MAILTO}><span class="hanko-cta__seal font-jp-serif">{JP.seal}</span><span>{content.bookCall} <span aria-hidden="true">→</span></span></a>
  </div>
</section>
