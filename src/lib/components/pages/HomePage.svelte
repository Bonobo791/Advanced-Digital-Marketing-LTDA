<script lang="ts">
  import { getContext, onMount } from 'svelte'
  import cityInk from '$lib/assets/city-ink.jpg'
  import portraitInk from '$lib/assets/portrait-ink.jpg'
  import Kanji from '$lib/components/chrome/Kanji.svelte'
  import MotionHeading from '$lib/components/chrome/MotionHeading.svelte'
  import { SITE_MOTION, type SiteMotion } from '$lib/client/site-motion'
  import { EMAIL, JP, MAILTO } from '$lib/constants'
  import { LOCALE_ROUTES, type Locale } from '$lib/locale'

  let { locale }: { locale: Locale } = $props()

  const english = {
    kick: 'Advanced Digital Marketing LTDA · SEO / GEO Engineering',
    hero: ['Search is changing.', 'We make sure you get', 'FOUND.'],
    heroLead: 'A São Paulo engineering studio putting US small businesses on top of Google and inside AI answers.',
    bookCall: 'Book a strategy call',
    exploreServices: 'Explore services',
    searchLabel: 'Search visibility',
    servicesHeading: 'The work behind being found.',
    services: [
      ['技術', 'Technical SEO', 'Make the site easy for search engines to understand.', 'Audits, crawl budget, Core Web Vitals, and structured data. The engineering most agencies outsource is the part we do in-house.'],
      ['生成', 'GEO / AI Search Visibility', 'Be cited by the answer engines.', "Content and entity work that gets you cited by ChatGPT, Perplexity, and Google's AI Overviews, not just ranked below them."],
      ['開発', 'Web Development', 'Build the site your strategy needs.', 'Fast, indexable builds with modern stacks and headless CMS options. We build the sites we optimize, so nothing gets lost between designer and SEO.'],
      ['広告', 'Paid Search', 'Use one conversion system across paid and organic.', 'Google and Meta Ads run against the same keyword and conversion data as your organic program. One strategy, two channels.'],
    ],
    processLabel: 'Process',
    processHeading: 'A route from signal to system.',
    steps: [
      ['監査', 'Audit', 'We crawl your site like Google does and read it like an AI does. You get a findings ledger, not a slide deck.'],
      ['設計', 'Architecture', 'Site structure, content map, and schema plan. Every fix is ranked by traffic impact before we touch anything.'],
      ['実装', 'Build', 'We ship the fixes ourselves: code, content, and structured data. No handoff gap, no developer relay.'],
      ['計測', 'Measure', 'Rankings, AI citations, and leads tracked monthly. If a number moves, you know why. If it does not, so do you.'],
    ],
    startAudit: 'Start with an audit',
    whyLabel: 'Why us',
    whyHeading: 'Built by engineers, priced by São Paulo.',
    whyLead: 'Search, media, and the site are one system.',
    whyLeadBold: 'We build the parts that make it work.',
    skylineAlt: 'Ink-textured São Paulo skyline at night',
    reasons: [
      ['壱', 'One team, no handoffs', 'The people who audit your site are the people who fix it.'],
      ['弐', 'US-market focus, LTDA cost base', 'Senior work without the US agency rate card.'],
      ['参', 'Built for where search is going', 'AI answers matter, not only ten blue links.'],
      ['終', 'You own everything', 'Code, content, and accounts stay yours. Leave any time and take it all.'],
    ],
    peopleLabel: 'People',
    portraitAlt: 'Ink rendered portrait of Andrew Weilbacher',
    role: 'Founder / Lead Engineer',
    bio: 'Technical SEO and web engineering for US small businesses. Previously the in-house fixer other agencies called, now running Advanced Digital Marketing LTDA from São Paulo for clients across the US.',
    meetAndrew: 'Meet Andrew',
    contactLabel: 'Contact',
    contactHeading: 'Stop losing customers to the answer box.',
    contactLead: 'One call. We will tell you exactly what is broken and what it is worth to fix it.',
    legal: 'Advanced Digital Marketing LTDA · CNPJ 68.425.709/0001-72 · São Paulo, Brazil',
  }

  const portuguese = {
    kick: 'Advanced Digital Marketing LTDA · Engenharia de SEO / GEO',
    hero: ['A busca está mudando.', 'Nós garantimos que você seja', 'ENCONTRADO.'],
    heroLead: 'Um estúdio de engenharia em São Paulo que coloca pequenas empresas dos EUA no topo do Google e dentro das respostas de IA.',
    bookCall: 'Agende uma conversa estratégica',
    exploreServices: 'Conheça os serviços',
    searchLabel: 'Visibilidade em buscas',
    servicesHeading: 'O trabalho por trás de ser encontrado.',
    services: [
      ['技術', 'SEO técnico', 'Torne o site fácil de entender para os mecanismos de busca.', 'Auditorias, orçamento de rastreamento, Core Web Vitals e dados estruturados. A engenharia que a maioria das agências terceiriza é feita internamente por nós.'],
      ['生成', 'GEO / Visibilidade em buscas de IA', 'Seja citado pelos mecanismos de resposta.', 'Trabalho de conteúdo e entidades que faz sua empresa ser citada pelo ChatGPT, Perplexity e AI Overviews do Google, não apenas ranqueada abaixo deles.'],
      ['開発', 'Desenvolvimento web', 'Construa o site que sua estratégia exige.', 'Sites rápidos e indexáveis com stacks modernas e opções de CMS headless. Construímos os sites que otimizamos para que nada se perca entre design e SEO.'],
      ['広告', 'Busca paga', 'Use um único sistema de conversão para o pago e o orgânico.', 'Google e Meta Ads trabalham com os mesmos dados de palavras-chave e conversão do seu programa orgânico. Uma estratégia, dois canais.'],
    ],
    processLabel: 'Processo',
    processHeading: 'Uma rota do sinal ao sistema.',
    steps: [
      ['監査', 'Auditoria', 'Rastreamos seu site como o Google e o lemos como uma IA. Você recebe um registro de achados, não uma apresentação de slides.'],
      ['設計', 'Arquitetura', 'Estrutura do site, mapa de conteúdo e plano de schema. Cada correção é classificada pelo impacto de tráfego antes de começarmos.'],
      ['実装', 'Implementação', 'Entregamos as correções: código, conteúdo e dados estruturados. Sem lacuna de handoff, sem intermediário de desenvolvimento.'],
      ['計測', 'Medição', 'Ranqueamentos, citações de IA e leads acompanhados mensalmente. Se um número muda, você sabe por quê. Se não muda, também.'],
    ],
    startAudit: 'Comece com uma auditoria',
    whyLabel: 'Por que nós',
    whyHeading: 'Feito por engenheiros, precificado em São Paulo.',
    whyLead: 'Busca, mídia e site formam um só sistema.',
    whyLeadBold: 'Construímos as peças que fazem tudo funcionar.',
    skylineAlt: 'Horizonte noturno de São Paulo com textura de tinta',
    reasons: [
      ['壱', 'Uma equipe, sem repasses', 'Quem audita seu site é quem corrige o que precisa ser corrigido.'],
      ['弐', 'Foco no mercado dos EUA, estrutura de custos de uma LTDA', 'Trabalho sênior sem a tabela de preços de uma agência americana.'],
      ['参', 'Preparado para o futuro da busca', 'Respostas de IA importam, não apenas os dez links azuis.'],
      ['終', 'Tudo continua sendo seu', 'Código, conteúdo e contas permanecem seus. Saia quando quiser e leve tudo.'],
    ],
    peopleLabel: 'Pessoas',
    portraitAlt: 'Retrato de Andrew Weilbacher em estilo de tinta',
    role: 'Fundador / Engenheiro-chefe',
    bio: 'SEO técnico e engenharia web para pequenas empresas dos EUA. Antes era o especialista interno a quem outras agências recorriam; hoje conduz a Advanced Digital Marketing LTDA, em São Paulo, para clientes em todo os Estados Unidos.',
    meetAndrew: 'Conheça Andrew',
    contactLabel: 'Contato',
    contactHeading: 'Pare de perder clientes para a caixa de respostas.',
    contactLead: 'Uma conversa. Vamos mostrar exatamente o que está quebrado e quanto vale corrigir.',
    legal: 'Advanced Digital Marketing LTDA · CNPJ 68.425.709/0001-72 · São Paulo, Brasil',
  }

  let content = $derived(locale === 'pt-BR' ? portuguese : english)
  let openService = $state(0)
  const motion = getContext<SiteMotion>(SITE_MOTION)

  onMount(() => motion.registerHero())
</script>

<section class="editorial-hero" class:editorial-hero--revealed={motion.state.hero === 'revealed'}>
  <Kanji char={JP.seal} class="hero-kanji" />
  <div class="editorial-hero__kick">
    <span class="font-jp-serif" data-hero-reveal style="--hero-delay: 0ms">先進</span>
    <span data-hero-reveal style="--hero-delay: 60ms">{content.kick}</span>
  </div>
  <div class="editorial-hero__content">
    <h1>
      <span class="hero-title" data-hero-reveal style="--hero-delay: 120ms">{content.hero[0]}</span>
      <span class="hero-line" data-hero-reveal style="--hero-delay: 180ms">{content.hero[1]}</span>
      <span class="hero-found-mask"><span class="hero-found" data-hero-found>{content.hero[2]}</span></span>
    </h1>
    <div class="editorial-hero__bottom">
      <p data-hero-reveal style="--hero-delay: 320ms">{content.heroLead}</p>
      <div class="button-row" data-hero-reveal style="--hero-delay: 420ms">
        <a class="button button--solid" href={MAILTO}>{content.bookCall} <span aria-hidden="true">→</span></a>
        <a class="button button--ghost" href="#services">{content.exploreServices} <span aria-hidden="true">↓</span></a>
      </div>
    </div>
  </div>
</section>

<section id="services" class="editorial-section editorial-section--paper services-section">
  <Kanji char="検索" class="section-kanji section-kanji--right" />
  <div class="section-inner">
    <p class="section-label motion-rise"><span class="font-jp">検索</span> {content.searchLabel}</p>
    <MotionHeading class="section-heading" text={content.servicesHeading} />
    <div class="service-ledger motion-wipe">
      {#each content.services as [jp, title, line, detail], index (title)}
        <article class:service-ledger__item--open={openService === index} class="service-ledger__item">
          <button
            class="service-ledger__button"
            type="button"
            aria-expanded={openService === index}
            aria-controls={`service-${index}`}
            onclick={() => (openService = openService === index ? -1 : index)}
          >
            <span class="service-ledger__jp font-jp">{jp}</span>
            <span class="service-ledger__title"><b>{title}</b><i>{line}</i></span>
            <span class="service-ledger__arrow" aria-hidden="true">→</span>
          </button>
          <div id={`service-${index}`} class="service-ledger__detail"><div><p>{detail}</p></div></div>
        </article>
      {/each}
    </div>
  </div>
</section>

<section id="process" class="editorial-section process-section">
  <Kanji char="工程" class="section-kanji section-kanji--left" />
  <div class="section-inner">
    <p class="section-label motion-rise"><span class="font-jp">工程</span> {content.processLabel}</p>
    <MotionHeading class="section-heading" text={content.processHeading} />
    <div class="process-steps">
      {#each content.steps as [jp, title, text] (title)}
        <article class="process-step motion-rise"><div class="process-step__body"><span class="process-step__jp font-jp">{jp}</span><span class="process-step__title">{title}</span><p>{text}</p></div></article>
      {/each}
    </div>
    <div class="process-cta"><a class="button button--ghost" href={MAILTO}>{content.startAudit} <span aria-hidden="true">→</span></a></div>
  </div>
</section>

<section id="why" class="editorial-section editorial-section--paper why-section">
  <Kanji char="強み" class="section-kanji section-kanji--right" />
  <div class="section-inner">
    <p class="section-label motion-rise"><span class="font-jp">強み</span> {content.whyLabel}</p>
    <div class="why-grid">
      <figure class="why-image"><img class="motion-image" src={cityInk} alt={content.skylineAlt} width="1396" height="975" loading="lazy" /></figure>
      <div class="why-copy"><MotionHeading class="section-heading" text={content.whyHeading} /><p class="why-copy__lead motion-rise">{content.whyLead} <b>{content.whyLeadBold}</b></p></div>
    </div>
    <ol class="reason-list">
      {#each content.reasons as [mark, title, detail] (mark)}
        <li class="motion-rise"><span class="reason-list__mark font-jp">{mark}</span><strong>{title}</strong><p>{detail}</p></li>
      {/each}
    </ol>
  </div>
</section>

<section id="people" class="editorial-section people-section">
  <Kanji char="人" class="section-kanji section-kanji--left" />
  <div class="section-inner">
    <p class="section-label motion-rise"><span class="font-jp">人</span> {content.peopleLabel}</p>
    <div class="people-grid">
      <figure class="people-portrait"><img class="motion-image" src={portraitInk} alt={content.portraitAlt} width="629" height="1430" loading="lazy" /></figure>
      <p class="people-pullquote font-jp-serif motion-rise">技術を、見つかる仕組みに。</p>
      <div class="people-bio motion-rise">
        <MotionHeading class="people-bio__heading" text="Andrew Weilbacher" /><p class="people-bio__role">{content.role}</p><p>{content.bio}</p>
        <a href={LOCALE_ROUTES.about[locale]}>{content.meetAndrew} <span aria-hidden="true">→</span></a>
      </div>
    </div>
  </div>
</section>

<section id="contact" class="editorial-section contact-section">
  <Kanji char={JP.seal} onRed class="section-kanji section-kanji--right" />
  <div class="section-inner">
    <p class="section-label motion-rise"><span class="font-jp">連絡</span> {content.contactLabel}</p>
    <MotionHeading class="section-heading" text={content.contactHeading} /><p class="contact-section__sub motion-rise">{content.contactLead}</p>
    <a class="hanko-cta" href={MAILTO}><span class="hanko-cta__seal font-jp-serif">{JP.seal}</span><span>{content.bookCall} <span aria-hidden="true">→</span></span></a>
    <a class="contact-section__mail" href={MAILTO}>{EMAIL}</a>
    <p class="contact-section__legal">{content.legal}</p>
  </div>
</section>
