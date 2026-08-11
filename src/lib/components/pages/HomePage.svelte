<script lang="ts">
  import { getContext, onMount } from 'svelte'
  import cityInk from '$lib/assets/city-ink.jpg'
  import portraitInk from '$lib/assets/andrew-new.jpg'
  import { EMAIL, MAILTO, PORTUGUESE_EMAIL, PT_MAILTO, WHATSAPP_URL } from '$lib/constants'
  import { SITE_MOTION, type SiteMotion } from '$lib/client/site-motion'
  import type { Locale } from '$lib/locale'

  let { locale }: { locale: Locale } = $props()
  type Service = { jp: string; title: string; line: string; detail: string; tags: string[]; product: string }
  type Step = { jp: string; title: string; text: string }
  type Reason = { mark: string; title: string; text: string }

  const english = {
    kicker: 'We design the answer.', searchChanging: 'Search is changing',
    hero: ['We make sure', 'you get', 'found.'],
    heroSub: 'A São Paulo engineering studio putting US small businesses on top of Google and inside AI answers.',
    book: 'Book a strategy call', email: 'Book a strategy call', whatsapp: 'Book via WhatsApp', emailCta: EMAIL, explore: 'Explore services', servicesLabel: 'Services', servicesHeading: 'What we do', serviceCta: 'Start with this service',
    services: [
      { jp: '技術', title: 'Technical SEO', line: 'The foundation everything else sits on.', detail: 'Crawl architecture, Core Web Vitals, structured data and indexation control. We find what is holding your site back and fix it at the code level, where the problem actually lives.', tags: ['Site audit', 'Schema markup', 'Speed engineering', 'Log analysis'], product: 'seo' },
      { jp: '生成', title: 'GEO', line: 'Get cited by the answer engines.', detail: 'Generative Engine Optimization. We structure your content, entities and authority signals so ChatGPT, Perplexity and Google AI Overviews quote you by name when your buyers ask.', tags: ['Entity mapping', 'Answer-first content', 'Citation tracking', 'llms.txt'], product: 'seo' },
      { jp: '開発', title: 'Web Development', line: 'Sites built to rank from the first commit.', detail: 'Next.js and Astro builds where performance budgets, semantic HTML and structured data are requirements, not afterthoughts. Migrations that keep every ranking you already own.', tags: ['Design and build', 'Headless CMS', 'Safe migrations', 'CRO iteration'], product: 'website-development' },
      { jp: '広告', title: 'Paid Search', line: 'Buy the clicks you cannot win yet.', detail: 'Google Ads managed against the same keyword map as your organic strategy. One plan, two channels, no wasted spend while the organic work compounds.', tags: ['Account restructure', 'Landing pages', 'Feed optimization', 'Weekly reporting'], product: 'google-ads-management' },
    ] as Service[],
    processLabel: 'Process', processHeading: 'How it runs',
    steps: [
      { jp: '監査', title: 'Audit', text: 'Two weeks inside your data. We map every query you should own and everything blocking it.' },
      { jp: '設計', title: 'Architecture', text: 'A 90-day plan with named owners, projected impact and the order of operations. You approve it before we touch anything.' },
      { jp: '実装', title: 'Build', text: 'We ship. Code, content and campaigns in weekly releases you can verify yourself, not in a monthly PDF.' },
      { jp: '計測', title: 'Measure', text: 'Rankings, AI citations and revenue, reported monthly in plain English with the next quarter already planned.' },
    ] as Step[],
    audit: 'Start with an audit', whyLabel: 'Why us', whyHeading: 'Built by engineers, priced by São Paulo.',
    whyLead: 'Most agencies sell you a retainer and staff it with whoever is free.',
    whyLeadStrong: 'We are a two-person engineering studio by design.',
    whyLeadAfter: ' The audit, the code, the content system and the ad account are all run by the people you actually talk to.',
    cityAlt: 'São Paulo skyline rendered in ink and vermilion',
    reasons: [
      { mark: '壱', title: 'Senior only', text: 'The person who audits your site is the person who writes the code. No handoffs, no account manager translating between you and the work.' },
      { mark: '弐', title: 'AI search first', text: 'Most agencies bolt GEO onto an SEO retainer. We build for answer engines from day one, because that is where your buyers are going.' },
      { mark: '参', title: 'US market, Brazil cost', text: 'A team that works your hours and knows the US market, at São Paulo rates. Better work, lower burn, no timezone gymnastics.' },
      { mark: '終', title: 'Everything in writing', text: 'Scope, timelines, projected impact and the assumptions behind them. If we cannot put a number on it, we say so.' },
    ] as Reason[],
    peopleLabel: 'People', peopleHeading: 'Who you work with',
    portraitAlt: 'Andrew Weilbacher, founder of Advanced Digital Marketing', quote: '「検索の未来を、設計する。」', role: 'Founder · Lead Engineer',
    bio: ['Andrew runs every engagement end to end: the audit, the architecture, the build and the reporting. Before founding Advanced Digital Marketing, he led engineering and growth work for US e-commerce and B2B service companies.', 'He started the studio in São Paulo for one reason: senior engineering for search should not cost what US agencies charge.'],
    write: 'Write to Andrew', contactLabel: 'Contact', contactHeading: 'Stop losing customers to the answer box.',
    contactSub: 'One email starts it. We reply within one business day with next steps and a straight answer on whether we can help.',
  }

  const portuguese = {
    kicker: 'SEO local · GEO · Sites que convertem', searchChanging: 'A busca está mudando',
    hero: ['Sua empresa precisa ser', 'encontrada onde a decisão', 'acontece.'],
    heroSub: 'Ajudamos empresas locais brasileiras a aparecer nas buscas certas, receber mais contatos e transformar tráfego em oportunidades — com engenharia, não relatórios genéricos.',
    book: 'Falar pelo WhatsApp', email: 'Agendar uma conversa por e-mail', whatsapp: 'Falar pelo WhatsApp', emailCta: PORTUGUESE_EMAIL, explore: 'Conheça os serviços', servicesLabel: 'Serviços', servicesHeading: 'O que fazemos', serviceCta: 'Começar com este serviço',
    services: [
      { jp: '技術', title: 'SEO técnico e local', line: 'Faça sua empresa aparecer nas buscas certas.', detail: 'Google Perfil da Empresa, páginas de serviço e cidade, dados estruturados, Core Web Vitals, indexação e intenção local.', tags: ['Perfil da Empresa', 'Páginas locais', 'Dados estruturados', 'Indexação'], product: 'seo' },
      { jp: '生成', title: 'GEO / visibilidade em respostas de IA', line: 'Seja lembrado quando alguém perguntar.', detail: 'Conteúdo, entidades, autoridade e FAQs estruturadas para ChatGPT, Perplexity e AI Overviews do Google — visibilidade em respostas de IA, não só nos resultados tradicionais.', tags: ['Entidades', 'Conteúdo para respostas', 'FAQs estruturadas', 'Citações'], product: 'seo' },
      { jp: '開発', title: 'Sites e landing pages', line: 'Caminhos claros para WhatsApp e orçamento.', detail: 'Páginas rápidas, mobile-first e com mensagem clara, construídas para transformar busca em conversa e pedido de orçamento.', tags: ['Mobile-first', 'Landing pages', 'Performance', 'Conversão'], product: 'website-development' },
      { jp: '広告', title: 'Mídia paga', line: 'Acelere a demanda que ainda não é orgânica.', detail: 'Google Ads e Meta alinhados à busca orgânica, à intenção local, às conversões e ao custo por oportunidade.', tags: ['Google Ads', 'Meta', 'Intenção local', 'Custo por oportunidade'], product: 'meta-ads-management' },
    ] as Service[],
    processLabel: 'Processo', processHeading: 'Como o trabalho acontece',
    steps: [
      { jp: '監査', title: 'Diagnóstico', text: 'Entendemos sua oferta, cidades, concorrência e os bloqueios técnicos que impedem sua empresa de aparecer.' },
      { jp: '設計', title: 'Plano', text: 'Um plano priorizado com responsáveis, impacto esperado e a ordem de execução. Você aprova antes de mexermos em qualquer coisa.' },
      { jp: '実装', title: 'Implementação', text: 'Código, conteúdo, páginas e campanhas em ciclos semanais que você consegue acompanhar.' },
      { jp: '計測', title: 'Medição', text: 'Visibilidade, contatos e oportunidades acompanhados com clareza, junto das próximas decisões.' },
    ] as Step[],
    audit: 'Comece com um diagnóstico', whyLabel: 'Por que nós', whyHeading: 'Engenharia de busca para empresas brasileiras.',
    whyLead: 'Você não precisa de mais um relatório genérico.',
    whyLeadStrong: 'Precisa de uma equipe sênior que execute.',
    whyLeadAfter: ' Da auditoria à implementação, busca, site e mídia são conduzidos pelas pessoas com quem você realmente fala.',
    cityAlt: 'Horizonte de São Paulo em tinta e vermelhão',
    reasons: [
      { mark: '壱', title: 'Equipe sênior, sem repasses', text: 'Quem audita seu site é quem escreve o código. Você fala direto com quem executa o trabalho.' },
      { mark: '弐', title: 'Conhecimento do mercado brasileiro com engenharia de verdade', text: 'Busca local, dados estruturados e implementação técnica para transformar intenção em contatos.' },
      { mark: '参', title: 'Busca, site e mídia trabalhando para o mesmo contato', text: 'Google, site, WhatsApp e anúncios partem do mesmo mapa de intenção e conversão.' },
      { mark: '終', title: 'Os ativos continuam sendo seus', text: 'Código, conteúdo, contas e dados permanecem seus. Tudo fica documentado e sob seu controle.' },
    ] as Reason[],
    peopleLabel: 'Pessoas', peopleHeading: 'Com quem você trabalha',
    portraitAlt: 'Andrew Weilbacher, fundador da Advanced Digital Marketing', quote: '「検索の未来を、設計する。」', role: 'Fundador · Engenheiro-chefe',
    bio: ['Andrew conduz cada projeto do início ao fim a partir de São Paulo: auditoria, arquitetura, implementação e medição. Você fala diretamente com o fundador e engenheiro que executa o trabalho.', 'A Advanced Digital Marketing LTDA é uma empresa brasileira registrada no CNPJ, com operação direta para negócios que precisam gerar contatos nas buscas locais e nas respostas de IA.'],
    write: 'Escreva para Andrew', contactLabel: 'Contato', contactHeading: 'Pare de perder clientes para quem aparece primeiro.',
    contactSub: 'Conte o que você vende, onde atende e o que precisa melhorar. A primeira resposta vem diretamente de quem vai analisar o trabalho.',
  }

  let content = $derived(locale === 'pt-BR' ? portuguese : english)
  let showWhatsapp = $derived(locale === 'pt-BR' && Boolean(WHATSAPP_URL))
  let localeMailto = $derived(locale === 'pt-BR' ? PT_MAILTO : MAILTO)
  let localeEmail = $derived(locale === 'pt-BR' ? PORTUGUESE_EMAIL : EMAIL)
  let openService = $state(-1)
  const motion = getContext<SiteMotion>(SITE_MOTION)
  const words = (text: string) => text.trim().split(/\s+/)

  onMount(() => {
    motion.registerHero()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const supportsView = CSS.supports?.('animation-timeline: view()') ?? false
    const revealables = document.querySelectorAll<HTMLElement>('.index-home .rise, .index-home .wipe, .index-home .shear .w, .index-home .why-img img, .index-home .p-portrait img')
    let observer: IntersectionObserver | undefined
    if (!reduced && !supportsView && 'IntersectionObserver' in window) {
      document.documentElement.classList.add('index-io')
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { entry.target.classList.add('io-on'); observer?.unobserve(entry.target) }
        })
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
      revealables.forEach((el) => observer?.observe(el))
    }
    const list = document.querySelector('.index-home .svc-list')
    let autoOpen: IntersectionObserver | undefined
    if (!reduced && list && 'IntersectionObserver' in window && window.matchMedia('(hover: none)').matches) {
      autoOpen = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) { openService = 0; autoOpen?.disconnect() }
      }, { threshold: 0.2 })
      autoOpen.observe(list)
    }
    return () => { observer?.disconnect(); autoOpen?.disconnect(); document.documentElement.classList.remove('index-io') }
  })
</script>

<div class="index-home" class:portuguese={locale === 'pt-BR'}>
  <section class="hero index-hero" class:hero-revealed={motion.state.hero === 'revealed'}>
    <div class="hero-bg" aria-hidden="true">
      <div class="kanji k-amb" style="right:-4vw;top:-6%">答</div>
      {#each [['検索・設計・生成・実装・計測・答・未来・', '64s'], ['アドバンスト・デジタル・マーケティング・', '96s'], ['検索・設計・生成・実装・計測・答・未来・', '78s'], ['アドバンスト・デジタル・マーケティング・', '110s'], ['検索・設計・生成・実装・計測・答・未来・', '58s']] as item, i}
        <div class="kcol kc{i + 1}"><span class="kcol-in" style="--spd:{item[1]}">{item[0].repeat(10)}</span></div>
      {/each}
      <div class="haze"></div><div class="scan"></div>
    </div>
    <div class="sec-inner hero-inner">
      <div class="hero-kick"><span class="jp" data-hero-reveal style="--hero-delay:0ms">「答えを、設計する。」</span><span class="en" data-hero-reveal style="--hero-delay:60ms">{content.kicker}</span></div>
      <p class="hero-line1" data-hero-reveal style="--hero-delay:120ms">{content.searchChanging}<b>.</b></p>
      <h1 class="hero-h1"><span class="h-mask"><span class="h-line" data-hero-reveal style="--hero-delay:180ms">{content.hero[0]}</span></span><span class="h-mask"><span class="h-line" data-hero-reveal style="--hero-delay:270ms">{content.hero[1]} <em>{content.hero[2]}</em></span></span></h1>
      <div class="hero-mid" data-hero-reveal style="--hero-delay:420ms">{#each content.services.slice(0, 4) as service}<a class="hidx" href="#services"><span class="jp">{service.jp}</span><span class="en">{service.title}</span></a>{/each}</div>
      <div class="hero-row"><p class="hero-sub" data-hero-reveal style="--hero-delay:440ms">{content.heroSub}</p><div class="cta-row" data-hero-reveal style="--hero-delay:520ms">{#if showWhatsapp}<a class="btn btn-solid" href={WHATSAPP_URL}>{content.whatsapp}</a><a class="btn btn-ghost" href={localeMailto}>{content.email}</a>{:else}<a class="btn btn-solid" href={localeMailto}>{content.email}</a><a class="btn btn-ghost" href="#services">{content.explore}</a>{/if}</div></div>
    </div>
  </section>

  <section class="paper-sec" id="services"><div class="kanji ink-stroke" style="left:-6vw;bottom:-10%" aria-hidden="true">検索</div><div class="sec-inner"><span class="sec-jp rise">{content.servicesLabel}<span class="font-jp">サービス</span></span><h2 class="shear">{#each words(content.servicesHeading) as word, i}<span class="w">{word}{i < words(content.servicesHeading).length - 1 ? ' ' : ''}</span>{/each}</h2><div class="svc-list">{#each content.services as service, i (service.title)}<div class="svc" aria-expanded={openService === i}><button class="svc-head" type="button" aria-label={service.title + ' details'} aria-expanded={openService === i} aria-controls={'service-' + i} onclick={() => (openService = openService === i ? -1 : i)}><span class="svc-jp font-jp">{service.jp}</span><span class="svc-en"><b>{service.title}</b><i>{service.line}</i></span><span class="svc-arrow" aria-hidden="true">→</span></button><div id={'service-' + i} class="svc-body"><div class="svc-body-in"><div class="svc-body-grid"><p>{service.detail}</p><div class="svc-tags">{#each service.tags as tag (tag)}<span>{tag}</span>{/each}</div></div><a class="svc-cta" href={(locale === 'pt-BR' ? '/pt-br/checkout/?product=' : '/checkout/?product=') + service.product}>{content.serviceCta}<span aria-hidden="true"> →</span></a></div></div></div>{/each}</div></div></section>

  <section id="process"><div class="kanji" style="right:-5vw;bottom:-14%" aria-hidden="true">工程</div><div class="sec-inner"><span class="sec-jp rise">{content.processLabel}<span class="font-jp">プロセス</span></span><h2 class="shear">{#each words(content.processHeading) as word, i}<span class="w">{word}{i < words(content.processHeading).length - 1 ? ' ' : ''}</span>{/each}</h2><div class="steps">{#each content.steps as step (step.title)}<div class="step rise"><div class="step-in"><span class="step-jp font-jp">{step.jp}</span><span class="step-en">{step.title}</span><p>{step.text}</p></div></div>{/each}</div><div class="proc-cta rise"><a class="btn btn-solid" href={localeMailto}>{content.audit}</a></div></div></section>

  <section class="paper-sec" id="why"><div class="kanji ink-stroke" style="right:-7vw;top:-10%" aria-hidden="true">強み</div><div class="sec-inner"><span class="sec-jp rise">{content.whyLabel}<span class="font-jp">強み</span></span><h2 class="shear">{#each words(content.whyHeading) as word, i}<span class="w">{word}{i < words(content.whyHeading).length - 1 ? ' ' : ''}</span>{/each}</h2><div class="why-grid"><div class="why-text wipe"><p class="lead">{content.whyLead} <b>{content.whyLeadStrong}</b>{content.whyLeadAfter}</p></div><figure class="why-img"><img src={cityInk} alt={content.cityAlt} width="1396" height="975" loading="lazy" /></figure></div><div class="reasons">{#each content.reasons as reason (reason.mark)}<div class="reason rise"><span class="num font-jp">{reason.mark}</span><b>{reason.title}</b><p>{reason.text}</p></div>{/each}</div></div></section>

  <section id="people"><div class="kanji" style="left:-6vw;top:-12%" aria-hidden="true">人</div><div class="sec-inner"><span class="sec-jp rise">{content.peopleLabel}<span class="font-jp">人</span></span><h2 class="shear">{#each words(content.peopleHeading) as word, i}<span class="w">{word}{i < words(content.peopleHeading).length - 1 ? ' ' : ''}</span>{/each}</h2><div class="people-grid"><figure class="p-portrait"><img src={portraitInk} alt={content.portraitAlt} width="1024" height="1440" loading="lazy" /></figure><p class="p-serif font-jp-serif rise">{content.quote}</p><div class="p-bio"><p class="name">Andrew Weilbacher</p><p class="role">{content.role}</p>{#each content.bio as paragraph (paragraph)}<p class="rise">{paragraph}</p>{/each}<a href={localeMailto}>{content.write}</a></div></div></div></section>

  <section class="contact" id="contact"><div class="kanji" style="right:-5vw;bottom:-16%" aria-hidden="true">連絡</div><div class="sec-inner"><span class="sec-jp rise" style="color:var(--ink)">{content.contactLabel}<span class="font-jp">連絡</span></span><h2 class="shear">{#each words(content.contactHeading) as word, i}<span class="w">{word}{i < words(content.contactHeading).length - 1 ? ' ' : ''}</span>{/each}</h2><p class="c-sub rise">{content.contactSub}</p>{#if showWhatsapp}<a class="cta-hanko rise" href={WHATSAPP_URL}><span class="seal font-jp">答</span><span class="txt">{content.whatsapp}</span></a><a class="c-mail rise" href={localeMailto}><span>{content.emailCta}</span></a>{:else}<a class="cta-hanko rise" href={localeMailto}><span class="seal font-jp">答</span><span class="txt">{content.email}</span></a><a class="c-mail rise" href={localeMailto}><span>{localeEmail}</span></a>{/if}</div></section>
</div>
