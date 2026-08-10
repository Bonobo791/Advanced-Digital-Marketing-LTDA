<script lang="ts">
  import { getContext, onMount } from 'svelte'
  import cityInk from '$lib/assets/city-ink.jpg'
  import andrewPortrait from '$lib/assets/andrew.png'
  import Kanji from '$lib/components/chrome/Kanji.svelte'
  import MotionHeading from '$lib/components/chrome/MotionHeading.svelte'
  import { SITE_MOTION, type SiteMotion } from '$lib/client/site-motion'
  import { EMAIL, JP, MAILTO } from '$lib/constants'
  import { type Locale } from '$lib/locale'

  let { locale }: { locale: Locale } = $props()

  const english = {
    kickerJp: "「答えを、設計する。」",
    kicker: "We design the answer.",
    hero: ['Search is changing', 'We make sure you get', 'FOUND.'],
    heroLead: 'A São Paulo engineering studio putting US small businesses on top of Google and inside AI answers.',
    bookCall: 'Book a strategy call',
    exploreServices: 'Explore services',
    servicesHeading: 'What we do',
    services: [
      ['技術', 'Technical SEO', 'The foundation everything else sits on.', 'Audits, crawl budget, Core Web Vitals, and structured data. The engineering most agencies outsource is the part we do in-house.'],
      ['生成', 'GEO', 'Get cited by the answer engines.', "Content and entity work that gets you cited by ChatGPT, Perplexity, and Google's AI Overviews, not just ranked below them."],
      ['開発', 'Web Development', 'Sites built to rank from the first commit.', 'Fast, indexable builds with modern stacks and headless CMS options. We build the sites we optimize, so nothing gets lost between designer and SEO.'],
      ['広告', 'Paid Search', 'Buy the clicks you cannot win yet.', 'Google and Meta Ads run against the same keyword and conversion data as your organic program. One strategy, two channels.'],
    ],
    processHeading: 'How it runs',
    steps: [
      ['監査', 'Audit', 'Two weeks inside your data. We map every query you should own and everything blocking it.'],
      ['設計', 'Architecture', 'A 90-day plan with named owners, projected impact and the order of operations. You approve it before we touch anything.'],
      ['実装', 'Build', 'We ship. Code, content and campaigns in weekly releases you can verify yourself, not in a monthly PDF.'],
      ['計測', 'Measure', 'Rankings, AI citations and revenue, reported monthly in plain English with the next quarter already planned.'],
    ],
    startAudit: 'Start with an audit',
    whyHeading: 'Built by engineers, priced by São Paulo.',
    whyLeadBold: 'We are a two-person engineering studio by design.',
    whyLeadBefore: 'Most agencies sell you a retainer and staff it with whoever is free. ',
    whyLeadAfter: ' The audit, the code, the content system and the ad account are all run by the people you actually talk to.',
    skylineAlt: 'Ink-textured São Paulo skyline at night',
    reasons: [
      ['壱', 'Senior only', 'The person who audits your site is the person who writes the code. No handoffs, no account manager translating between you and the work.'],
      ['弐', 'AI search first', 'Most agencies bolt GEO onto an SEO retainer. We build for answer engines from day one, because that is where your buyers are going.'],
      ['参', 'US market, Brazil cost', 'A team that works your hours and knows the US market, at São Paulo rates. Better work, lower burn, no timezone gymnastics.'],
      ['終', 'Everything in writing', 'Scope, timelines, projected impact and the assumptions behind them. If we cannot put a number on it, we say so.'],
    ],
    peopleHeading: 'Who you work with',
    portraitAlt: 'Ink rendered portrait of Andrew Weilbacher',
    role: 'Founder · Lead Engineer',
    bios: [
      'Andrew runs every engagement end to end: the audit, the architecture, the build and the reporting. Before founding Advanced Digital Marketing, he led engineering and growth work for US e-commerce and B2B service companies.',
      'He started the studio in São Paulo for one reason: senior engineering for search should not cost what US agencies charge.',
    ],
    meetAndrew: 'Write to Andrew',
    contactHeading: 'Stop losing customers to the answer box.',
    contactLead: 'One email starts it. We reply within one business day with next steps and a straight answer on whether we can help.',
  }

  const portuguese = {
    kickerJp: "「答えを、設計する。」",
    kicker: "Nós projetamos a resposta.",
    hero: ['A busca está mudando', 'Nós garantimos que você seja', 'ENCONTRADO.'],
    heroLead: 'Um estúdio de engenharia em São Paulo que coloca pequenas empresas dos EUA no topo do Google e dentro das respostas de IA.',
    bookCall: 'Agende uma conversa estratégica',
    exploreServices: 'Conheça os serviços',
    servicesHeading: 'O trabalho por trás de ser encontrado.',
    services: [
      ['技術', 'SEO técnico', 'Torne o site fácil de entender para os mecanismos de busca.', 'Auditorias, orçamento de rastreamento, Core Web Vitals e dados estruturados. A engenharia que a maioria das agências terceiriza é feita internamente por nós.'],
      ['生成', 'GEO / Visibilidade em buscas de IA', 'Seja citado pelos mecanismos de resposta.', 'Trabalho de conteúdo e entidades que faz sua empresa ser citada pelo ChatGPT, Perplexity e AI Overviews do Google, não apenas ranqueada abaixo deles.'],
      ['開発', 'Desenvolvimento web', 'Construa o site que sua estratégia exige.', 'Sites rápidos e indexáveis com stacks modernas e opções de CMS headless. Construímos os sites que otimizamos para que nada se perca entre design e SEO.'],
      ['広告', 'Busca paga', 'Use um único sistema de conversão para o pago e o orgânico.', 'Google e Meta Ads trabalham com os mesmos dados de palavras-chave e conversão do seu programa orgânico. Uma estratégia, dois canais.'],
    ],
    processHeading: 'Uma rota do sinal ao sistema.',
    steps: [
      ['監査', 'Auditoria', 'Rastreamos seu site como o Google e o lemos como uma IA. Você recebe um registro de achados, não uma apresentação de slides.'],
      ['設計', 'Arquitetura', 'Estrutura do site, mapa de conteúdo e plano de schema. Cada correção é classificada pelo impacto de tráfego antes de começarmos.'],
      ['実装', 'Implementação', 'Entregamos as correções: código, conteúdo e dados estruturados. Sem lacuna de handoff, sem intermediário de desenvolvimento.'],
      ['計測', 'Medição', 'Ranqueamentos, citações de IA e leads acompanhados mensalmente. Se um número muda, você sabe por quê. Se não muda, também.'],
    ],
    startAudit: 'Comece com uma auditoria',
    whyHeading: 'Feito por engenheiros, precificado em São Paulo.',
    whyLeadBold: 'Construímos as peças que fazem tudo funcionar.',
    whyLeadBefore: 'A maioria das agências vende uma mensalidade e coloca quem estiver disponível no trabalho. ',
    whyLeadAfter: ' A auditoria, o código, o sistema de conteúdo e a conta de anúncios são conduzidos pelas pessoas com quem você realmente fala.',
    skylineAlt: 'Horizonte noturno de São Paulo com textura de tinta',
    reasons: [
      ['壱', 'Uma equipe, sem repasses', 'Quem audita seu site é quem corrige o que precisa ser corrigido.'],
      ['弐', 'Foco no mercado dos EUA, estrutura de custos de uma LTDA', 'Trabalho sênior sem a tabela de preços de uma agência americana.'],
      ['参', 'Preparado para o futuro da busca', 'Respostas de IA importam, não apenas os dez links azuis.'],
      ['終', 'Tudo continua sendo seu', 'Código, conteúdo e contas permanecem seus. Saia quando quiser e leve tudo.'],
    ],
    peopleHeading: 'Com quem você trabalha',
    portraitAlt: 'Retrato de Andrew Weilbacher em estilo de tinta',
    role: 'Fundador / Engenheiro-chefe',
    bios: [
      'Andrew conduz cada projeto do início ao fim: a auditoria, a arquitetura, a implementação e o acompanhamento. Antes de fundar a Advanced Digital Marketing, liderou trabalho de engenharia e crescimento para empresas de e-commerce e B2B nos EUA.',
      'Ele criou o estúdio em São Paulo por um motivo: engenharia sênior para busca não deveria custar o que as agências americanas cobram.',
    ],
    meetAndrew: 'Conheça Andrew',
    contactHeading: 'Pare de perder clientes para a caixa de respostas.',
    contactLead: 'Uma conversa. Vamos mostrar exatamente o que está quebrado e quanto vale corrigir.',
  }

  let content = $derived(locale === 'pt-BR' ? portuguese : english)
  let openService = $state(-1)
  const motion = getContext<SiteMotion>(SITE_MOTION)

  onMount(() => motion.registerHero())
</script>

<section class="editorial-hero" class:editorial-hero--revealed={motion.state.hero === 'revealed'}>
  <Kanji char={JP.seal} class="hero-kanji" />
  <div class="editorial-hero__kick">
    <span class="font-jp-serif" data-hero-reveal style="--hero-delay: 0ms">{content.kickerJp}</span>
    <span data-hero-reveal style="--hero-delay: 60ms">{content.kicker}</span>
  </div>
  <div class="editorial-hero__content">
    <h1>
      <span class="hero-title" data-hero-reveal style="--hero-delay: 120ms">{content.hero[0]}<b>.</b></span>
      <span class="hero-line" data-hero-reveal style="--hero-delay: 200ms">{content.hero[1]}</span>
      <span class="hero-found-mask"><span class="hero-found" data-hero-found>{content.hero[2]}</span></span>
    </h1>
    <div class="editorial-hero__bottom">
      <p data-hero-reveal style="--hero-delay: 320ms">{content.heroLead}</p>
      <div class="button-row" data-hero-reveal style="--hero-delay: 420ms">
        <a class="button button--solid" href={MAILTO}>{content.bookCall}</a>
        <a class="button button--ghost" href="#services">{content.exploreServices}</a>
      </div>
    </div>
  </div>
</section>

<section id="services" class="editorial-section editorial-section--paper services-section">
  <Kanji char="検索" class="section-kanji section-kanji--services" />
  <div class="section-inner">
    <p class="section-label motion-rise"><span class="font-jp">サービス</span></p>
    <MotionHeading class="section-heading" text={content.servicesHeading} />
    <div class="service-ledger">
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
  <Kanji char="工程" class="section-kanji section-kanji--process" />
  <div class="section-inner">
    <p class="section-label motion-rise"><span class="font-jp">プロセス</span></p>
    <MotionHeading class="section-heading" text={content.processHeading} />
    <div class="process-steps">
      {#each content.steps as [jp, title, text] (title)}
        <article class="process-step motion-rise"><div class="process-step__body"><span class="process-step__jp font-jp">{jp}</span><span class="process-step__title">{title}</span><p>{text}</p></div></article>
      {/each}
    </div>
    <div class="process-cta"><a class="button button--solid" href={MAILTO}>{content.startAudit}</a></div>
  </div>
</section>

<section id="why" class="editorial-section editorial-section--paper why-section">
  <Kanji char="強み" class="section-kanji section-kanji--why" />
  <div class="section-inner">
    <p class="section-label motion-rise"><span class="font-jp">強み</span></p>
    <MotionHeading class="section-heading" text={content.whyHeading} />
    <div class="why-grid">
      <figure class="why-image"><img class="motion-image" src={cityInk} alt={content.skylineAlt} width="1396" height="975" loading="lazy" /></figure>
      <div class="why-copy motion-wipe"><p class="why-copy__lead">{content.whyLeadBefore}<b>{content.whyLeadBold}</b>{content.whyLeadAfter}</p></div>
    </div>
    <ol class="reason-list">
      {#each content.reasons as [mark, title, detail] (mark)}
        <li class="motion-rise"><span class="reason-list__mark font-jp">{mark}</span><strong>{title}</strong><p>{detail}</p></li>
      {/each}
    </ol>
  </div>
</section>

<section id="people" class="editorial-section people-section">
  <Kanji char="人" class="section-kanji section-kanji--people" />
  <div class="section-inner">
    <p class="section-label motion-rise"><span class="font-jp">人</span></p>
    <MotionHeading class="section-heading" text={content.peopleHeading} />
    <div class="people-grid">
      <figure class="people-portrait"><img class="motion-image" src={andrewPortrait} alt={content.portraitAlt} width="529" height="744" loading="lazy" /></figure>
      <p class="people-pullquote font-jp-serif motion-rise">「検索の未来を、設計する。」</p>
      <div class="people-bio motion-rise">
        <p class="people-bio__heading">Andrew Weilbacher</p><p class="people-bio__role">{content.role}</p>
        {#each content.bios as bio (bio)}<p>{bio}</p>{/each}
        <a href={MAILTO}>{content.meetAndrew}</a>
      </div>
    </div>
  </div>
</section>

<section id="contact" class="editorial-section contact-section">
  <Kanji char="連絡" onRed class="section-kanji section-kanji--contact" />
  <div class="section-inner">
    <p class="section-label motion-rise"><span class="font-jp">連絡</span></p>
    <MotionHeading class="section-heading" text={content.contactHeading} /><p class="contact-section__sub motion-rise">{content.contactLead}</p>
    <a class="hanko-cta motion-rise" href={MAILTO}><span class="hanko-cta__seal font-jp-serif">{JP.seal}</span><span>{content.bookCall}</span></a>
    <a class="contact-section__mail motion-rise" href={MAILTO}>{EMAIL}</a>
  </div>
</section>
