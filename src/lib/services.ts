import type { Locale } from '$lib/locale'
import { normalizePath } from './path.ts'
import type { ServiceId as CatalogServiceId } from './catalog'

export const SERVICE_IDS = ['technical-seo', 'geo', 'web-development', 'paid-search', 'meta-ads', 'ai-automation'] as const
export type ServiceId = (typeof SERVICE_IDS)[number]

export type ServiceOption = {
  jp: string
  name: string
  price: string
  per: string
  desc: string
  items: string[]
  cta: string
  subject: string
}

export type ServiceStep = { jp: string; title: string; text: string }

export type ServiceContent = {
  navLabel: string
  navJp: string
  kicker: string
  promise: string
  hero: [string, string]
  sub: string
  optionsLabel: string
  optionsHeading: string
  optionsLead: string
  options: ServiceOption[]
  optionsNote: string
  optionsNoteStrong: string
  processLabel: string
  processHeading: string
  steps: ServiceStep[]
  auditCta: string
  contactLabel: string
  contactHeading: string
  contactSub: string
  bookCall: string
  seeOptions: string
}

export const SERVICE_ROUTES: Record<ServiceId, Record<Locale, string>> = {
  'technical-seo': { 'en-US': '/services/technical-seo/', 'pt-BR': '/pt-br/servicos/technical-seo/' },
  geo: { 'en-US': '/services/geo/', 'pt-BR': '/pt-br/servicos/geo/' },
  'web-development': { 'en-US': '/services/web-development/', 'pt-BR': '/pt-br/servicos/web-development/' },
  'paid-search': { 'en-US': '/services/paid-search/', 'pt-BR': '/pt-br/servicos/paid-search/' },
  'meta-ads': { 'en-US': '/services/meta-ads/', 'pt-BR': '/pt-br/servicos/meta-ads/' },
  'ai-automation': { 'en-US': '/services/ai-automation/', 'pt-BR': '/pt-br/servicos/ai-automation/' },
}

/**
 * Maps each site service page to the subscription-catalog services that belong
 * to it. Used to pre-select the right services when the mix-and-match
 * configurator is embedded in a service page or the gateway. Empty arrays mean
 * the service has no monthly subscription offering (quote-only or one-time).
 */
export const SERVICE_SUBSCRIPTIONS: Record<ServiceId, CatalogServiceId[]> = {
  'technical-seo': ['seo-content', 'backlinks'],
  geo: [],
  'web-development': ['hosting'],
  'paid-search': ['paid-search'],
  'meta-ads': ['meta-ads'],
  'ai-automation': [],
}


export const SERVICE_META: Record<Locale, Record<ServiceId, { title: string; description: string }>> = {
  'en-US': {
    'technical-seo': {
      title: 'Advanced Digital Marketing LTDA | Technical SEO',
      description:
        'Technical SEO by Advanced Digital Marketing: crawl architecture, Core Web Vitals, structured data and indexation control, fixed at the code level.',
    },
    geo: {
      title: 'Advanced Digital Marketing LTDA | GEO',
      description:
        'GEO by Advanced Digital Marketing: entity mapping, answer-first content and citation tracking that get you quoted by ChatGPT, Perplexity and Google AI Overviews.',
    },
    'web-development': {
      title: 'Advanced Digital Marketing LTDA | Web Development',
      description:
        'Web development by Advanced Digital Marketing: Next.js and Astro builds where performance budgets, semantic HTML and structured data are built in from the first commit.',
    },
    'paid-search': {
      title: 'Advanced Digital Marketing LTDA | Paid Search',
      description:
        'Paid search by Advanced Digital Marketing: Google Ads managed against the same keyword map as your organic strategy. One plan, two channels, no wasted spend.',
    },
    'meta-ads': {
      title: 'Advanced Digital Marketing LTDA | Meta Ads',
      description:
        'Meta Ads by Advanced Digital Marketing: Facebook and Instagram campaigns managed against the same keyword and conversion data as your organic strategy. One plan, every channel.',
    },
    'ai-automation': {
      title: 'Advanced Digital Marketing LTDA | AI Automation',
      description:
        'AI automation by Advanced Digital Marketing: agents, integrations and internal tools that remove repetitive work from your operations — scoped and quoted per project.',
    },
  },
  'pt-BR': {
    'technical-seo': {
      title: 'Advanced Digital Marketing LTDA | SEO técnico e local',
      description:
        'SEO técnico e local pela Advanced Digital Marketing: arquitetura de rastreamento, Core Web Vitals, dados estruturados e controle de indexação, corrigidos onde o problema realmente está: no código.',
    },
    geo: {
      title: 'Advanced Digital Marketing LTDA | GEO e visibilidade em IA',
      description:
        'GEO pela Advanced Digital Marketing: mapeamento de entidades, conteúdo answer-first e rastreamento de citações para você ser citado pelo nome no ChatGPT, Perplexity e AI Overviews do Google.',
    },
    'web-development': {
      title: 'Advanced Digital Marketing LTDA | Sites e landing pages',
      description:
        'Desenvolvimento web pela Advanced Digital Marketing: builds em Next.js e Astro com orçamentos de performance, HTML semântico e dados estruturados embutidos desde o primeiro commit.',
    },
    'paid-search': {
      title: 'Advanced Digital Marketing LTDA | Google Ads',
      description:
        'Google Ads pela Advanced Digital Marketing: gerenciado contra o mesmo mapa de palavras-chave da sua estratégia orgânica. Um plano, dois canais, sem gasto desperdiçado.',
    },
    'meta-ads': {
      title: 'Advanced Digital Marketing LTDA | Meta Ads',
      description:
        'Meta Ads pela Advanced Digital Marketing: campanhas no Facebook e Instagram gerenciadas contra os mesmos dados de palavras-chave e conversão da sua estratégia orgânica. Um plano, todos os canais.',
    },
    'ai-automation': {
      title: 'Advanced Digital Marketing LTDA | Automação com IA',
      description:
        'Automação com IA pela Advanced Digital Marketing: agentes, integrações e ferramentas internas que removem trabalho repetitivo das suas operações — escopados e orçados sob consulta.',
    },
  },
}

export const SERVICE_CONTENT: Record<Locale, Record<ServiceId, ServiceContent>> = {
  'en-US': {
    'technical-seo': {
      navLabel: 'Technical SEO',
      navJp: '技術',
      kicker: 'Service · Technical SEO',
      promise: 'Rankings start at the code level',
      hero: ['Technical', 'SEO.'],
      sub: 'Crawl architecture, Core Web Vitals, structured data and indexation control, fixed where the problem actually lives: in the code.',
      optionsLabel: 'Options',
      optionsHeading: 'Choose how we start.',
      optionsLead:
        'Five ways to engage, one standard of work. Every option ends with fixes you can verify yourself, not a PDF of recommendations.',
      options: [
        {
          jp: '監査',
          name: 'The Audit',
          price: '$2,400',
          per: 'One time · 2 weeks',
          desc: 'A complete technical diagnosis with a prioritized fix list, so you know exactly what is blocking you and in what order to attack it.',
          items: [
            'Full crawl and log-file analysis',
            'Core Web Vitals report, page by page',
            'Structured data and indexation review',
            'Prioritized fix list with effort estimates',
            '90-day roadmap, in writing',
          ],
          cta: 'Start with the audit',
          subject: 'Audit request',
        },
        {
          jp: '実装',
          name: 'Fix Sprint',
          price: '$6,800',
          per: 'One time · 4 weeks',
          desc: 'The audit, plus hands on keyboards. We ship the fixes ourselves and re-crawl to prove the numbers moved.',
          items: [
            'Everything in The Audit',
            'We implement the fixes in your stack',
            'Speed engineering to green vitals',
            'Schema written and deployed',
            'Before/after re-crawl verification',
          ],
          cta: 'Book the sprint',
          subject: 'Fix sprint request',
        },
        {
          jp: '計測',
          name: 'Retainer',
          price: '$2,900',
          per: 'Per month · 6-month minimum',
          desc: 'Continuous technical ownership: monitoring, monthly releases and regression alerts, so the wins stay won.',
          items: [
            '24/7 uptime and crawl monitoring',
            'Monthly technical release cycle',
            'Regression alerts before rankings drop',
            'Quarterly strategy review',
            'Priority support, same-day answers',
          ],
          cta: 'Talk retainers',
          subject: 'Retainer inquiry',
        },
        {
          jp: '設計',
          name: 'Content Development',
          price: '$3,500',
          per: 'Per month · 3-month minimum',
          desc: 'Pages, articles and service copy written to answer the questions your buyers actually ask, structured so crawlers and AI engines both get it.',
          items: [
            'Answer-first page briefs',
            'On-page content written and edited',
            'Internal linking built in',
            'Schema attached to every page',
            'Monthly publishing cycle',
          ],
          cta: 'Start content development',
          subject: 'Content development request',
        },
        {
          jp: '検索',
          name: 'Backlinks',
          price: '$1,900',
          per: 'Per month · 3-month minimum',
          desc: 'Authority earned from sites that matter: outreach, digital PR and linkable assets, with the source and the rationale reported for every placement.',
          items: [
            'Linkable asset production',
            'Outreach and digital PR',
            'Placement with rationale for each',
            'Toxic link cleanup',
            'Monthly authority report',
          ],
          cta: 'Start link building',
          subject: 'Backlinks request',
        },
      ],
      optionsNote: 'senior engineers only, weekly written updates, and a straight answer if we are not the right fit.',
      optionsNoteStrong: 'Every option:',
      processLabel: 'Process',
      processHeading: 'How it runs',
      steps: [
        { jp: '監査', title: 'Audit', text: 'Two weeks inside your data. We map every query you should own and everything blocking it.' },
        { jp: '設計', title: 'Architecture', text: 'A 90-day plan with named owners, projected impact and the order of operations. You approve it before we touch anything.' },
        { jp: '実装', title: 'Build', text: 'We ship. Code, content and campaigns in weekly releases you can verify yourself, not in a monthly PDF.' },
        { jp: '計測', title: 'Measure', text: 'Rankings, AI citations and revenue, reported monthly in plain English with the next quarter already planned.' },
      ],
      auditCta: 'Start with an audit',
      contactLabel: 'Contact',
      contactHeading: 'Stop losing customers to the answer box.',
      contactSub: 'One email starts it. We reply within one business day with next steps and a straight answer on whether we can help.',
      bookCall: 'Book a strategy call',
      seeOptions: 'See the options',
    },
    geo: {
      navLabel: 'GEO',
      navJp: '生成',
      kicker: 'Service · GEO',
      promise: 'Get cited by the answer engines',
      hero: ['Be the', 'answer.'],
      sub: 'Generative Engine Optimization. We structure your content, entities and authority signals so ChatGPT, Perplexity and Google AI Overviews quote you by name when your buyers ask.',
      optionsLabel: 'Options',
      optionsHeading: 'Get into the answer, not under it.',
      optionsLead:
        'Three ways to start. Every option ends with citations you can search for and verify yourself, not a report of recommendations.',
      options: [
        {
          jp: '監査',
          name: 'The Citation Audit',
          price: '$2,400',
          per: 'One time · 2 weeks',
          desc: 'Where the answer engines already quote you, where they should, and exactly what is blocking it.',
          items: [
            'Entity and brand mention map',
            'Answer engine citation audit',
            'Competitor citation comparison',
            'Prioritized content and entity plan',
            '90-day roadmap, in writing',
          ],
          cta: 'Start with the citation audit',
          subject: 'Citation audit request',
        },
        {
          jp: '実装',
          name: 'Citation Sprint',
          price: '$6,800',
          per: 'One time · 4 weeks',
          desc: 'The audit plus the build: entity pages, answer-first content and llms.txt, shipped and re-checked.',
          items: [
            'Everything in The Citation Audit',
            'Entity pages and schema deployed',
            'Answer-first content written',
            'llms.txt and machine-readable feeds',
            'Before/after citation re-check',
          ],
          cta: 'Book the sprint',
          subject: 'Citation sprint request',
        },
        {
          jp: '計測',
          name: 'Visibility Retainer',
          price: '$2,900',
          per: 'Per month · 6-month minimum',
          desc: 'Continuous entity and content work so your citation share grows, and holds.',
          items: [
            'Monthly content and entity releases',
            'Citation share tracking',
            'New question monitoring',
            'Quarterly strategy review',
            'Priority support, same-day answers',
          ],
          cta: 'Talk retainers',
          subject: 'Visibility retainer inquiry',
        },
      ],
      optionsNote: 'senior engineers only, weekly written updates, and a straight answer if we are not the right fit.',
      optionsNoteStrong: 'Every option:',
      processLabel: 'Process',
      processHeading: 'How it runs',
      steps: [
        { jp: '監査', title: 'Audit', text: 'We map your entities, your existing citations and where the answer engines already mention you, then find where they should.' },
        { jp: '設計', title: 'Architecture', text: 'An entity and content map: the questions buyers ask, who answers them today, and the page that should own each one.' },
        { jp: '実装', title: 'Build', text: 'We write and structure the answers, deploy the schema and ship llms.txt so your content is legible to machines.' },
        { jp: '計測', title: 'Measure', text: 'Citation share across ChatGPT, Perplexity and AI Overviews, reported monthly in plain English.' },
      ],
      auditCta: 'Start with the citation audit',
      contactLabel: 'Contact',
      contactHeading: 'Be the name the answer engines quote.',
      contactSub: 'One email starts it. We reply within one business day with next steps and a straight answer on whether we can help.',
      bookCall: 'Book a strategy call',
      seeOptions: 'See the options',
    },
    'web-development': {
      navLabel: 'Web Development',
      navJp: '開発',
      kicker: 'Service · Web Development',
      promise: 'Sites built to rank from the first commit',
      hero: ['Built to', 'rank.'],
      sub: 'Next.js and Astro builds where performance budgets, semantic HTML and structured data are requirements, not afterthoughts. Migrations that keep every ranking you already own.',
      optionsLabel: 'Options',
      optionsHeading: 'Build it right, rank from day one.',
      optionsLead:
        'Three ways to engage, one standard of work. Every build ships with performance budgets, semantic HTML and structured data included.',
      options: [
        {
          jp: '監査',
          name: 'The Build Audit',
          price: '$2,400',
          per: 'One time · 2 weeks',
          desc: 'A technical diagnosis of your current site or stack, with the fix list and rebuild options priced.',
          items: [
            'Performance and vitals review',
            'Indexation and schema audit',
            'Stack and CMS assessment',
            'Rebuild vs fix recommendation',
            'Budget with effort estimates',
          ],
          cta: 'Start with the build audit',
          subject: 'Build audit request',
        },
        {
          jp: '実装',
          name: 'Build Sprint',
          price: '$6,800',
          per: 'One time · 4 weeks',
          desc: 'Design and build of a focused marketing site, engineered to rank from launch.',
          items: [
            'Everything in The Build Audit',
            'Design and front-end build',
            'Performance budget enforced',
            'Semantic HTML and schema built in',
            'Headless CMS setup',
          ],
          cta: 'Book the sprint',
          subject: 'Build sprint request',
        },
        {
          jp: '計測',
          name: 'Build Retainer',
          price: '$2,900',
          per: 'Per month · 6-month minimum',
          desc: 'Continuous development after launch: releases, experiments and CRO iteration.',
          items: [
            'Monthly release cycle',
            'CRO iteration and experiments',
            'Vitals and uptime monitoring',
            'Content and landing page builds',
            'Priority support, same-day answers',
          ],
          cta: 'Talk retainers',
          subject: 'Build retainer inquiry',
        },
      ],
      optionsNote: 'senior engineers only, weekly written updates, and a straight answer if we are not the right fit.',
      optionsNoteStrong: 'Every option:',
      processLabel: 'Process',
      processHeading: 'How it runs',
      steps: [
        { jp: '監査', title: 'Audit', text: 'We review your stack, your Core Web Vitals and your indexation the way a search crawler would.' },
        { jp: '設計', title: 'Architecture', text: 'A build plan with performance budgets, semantic HTML and structured data locked in before a line is written.' },
        { jp: '実装', title: 'Build', text: 'Design, code and CMS in weekly releases. You can verify the site ranking before it launches.' },
        { jp: '計測', title: 'Measure', text: 'Vitals, indexation and rankings tracked from launch, reported monthly in plain English.' },
      ],
      auditCta: 'Start with the build audit',
      contactLabel: 'Contact',
      contactHeading: 'Sites that rank from the first commit.',
      contactSub: 'One email starts it. We reply within one business day with next steps and a straight answer on whether we can help.',
      bookCall: 'Book a strategy call',
      seeOptions: 'See the options',
    },
    'paid-search': {
      navLabel: 'Paid Search',
      navJp: '広告',
      kicker: 'Service · Paid Search',
      promise: 'Buy the clicks you cannot win yet',
      hero: ['Own the', 'clicks.'],
      sub: 'Google Ads managed against the same keyword map as your organic strategy. One plan, two channels, no wasted spend while the organic work compounds.',
      optionsLabel: 'Options',
      optionsHeading: 'Spend that compounds, not burns.',
      optionsLead:
        'Three ways to start. Every option runs on the same keyword map as your organic strategy, so the channels reinforce each other.',
      options: [
        {
          jp: '監査',
          name: 'The Account Audit',
          price: '$2,400',
          per: 'One time · 2 weeks',
          desc: 'A full account diagnosis: structure, keywords, landing pages and wasted spend, with the fixes ranked.',
          items: [
            'Account structure review',
            'Keyword and match type map',
            'Wasted spend analysis',
            'Landing page assessment',
            '90-day plan, in writing',
          ],
          cta: 'Start with the account audit',
          subject: 'Account audit request',
        },
        {
          jp: '実装',
          name: 'Launch Sprint',
          price: '$6,800',
          per: 'One time · 4 weeks',
          desc: 'The restructure shipped: new account architecture, campaigns, landing pages and tracking.',
          items: [
            'Everything in The Account Audit',
            'Account restructure and build-out',
            'Landing pages written and built',
            'Feed and conversion tracking',
            'Launch with weekly reporting',
          ],
          cta: 'Book the sprint',
          subject: 'Launch sprint request',
        },
        {
          jp: '計測',
          name: 'Paid Retainer',
          price: '$2,900',
          per: 'Per month · 6-month minimum',
          desc: 'Managed spend with weekly optimization, reported against the organic numbers.',
          items: [
            'Weekly optimization cycle',
            'Weekly spend and lead reporting',
            'Bid and budget management',
            'New keyword expansion',
            'Priority support, same-day answers',
          ],
          cta: 'Talk retainers',
          subject: 'Paid retainer inquiry',
        },
      ],
      optionsNote: 'senior engineers only, weekly written updates, and a straight answer if we are not the right fit.',
      optionsNoteStrong: 'Every option:',
      processLabel: 'Process',
      processHeading: 'How it runs',
      steps: [
        { jp: '監査', title: 'Audit', text: 'We open the account, the keyword map and the conversion data, and find where the budget is leaking.' },
        { jp: '設計', title: 'Architecture', text: 'One plan across paid and organic: the same keyword map, named owners and a 90-day flight order.' },
        { jp: '実装', title: 'Build', text: 'Account restructure, landing pages and feeds shipped in weekly releases you can verify yourself.' },
        { jp: '計測', title: 'Measure', text: 'Spend, position and cost per lead reported weekly, with the organic work compounding alongside.' },
      ],
      auditCta: 'Start with the account audit',
      contactLabel: 'Contact',
      contactHeading: 'Turn spend into rankings you own.',
      contactSub: 'One email starts it. We reply within one business day with next steps and a straight answer on whether we can help.',
      bookCall: 'Book a strategy call',
      seeOptions: 'See the options',
    },
    'meta-ads': {
      navLabel: 'Meta Ads',
      navJp: '広告',
      kicker: 'Service · Meta Ads',
      promise: 'Buy the attention you cannot win yet',
      hero: ['Reach', 'that converts.'],
      sub: 'Facebook and Instagram campaigns managed against the same keyword and conversion data as your organic strategy. Audiences, creative and budget in one plan, no wasted spend.',
      optionsLabel: 'Options',
      optionsHeading: 'Spend where the eyes are.',
      optionsLead:
        'Three ways to start. Every option runs on the same conversion and audience data as the rest of your strategy, so the channels reinforce each other.',
      options: [
        {
          jp: '監査',
          name: 'The Meta Audit',
          price: '$2,400',
          per: 'One time · 2 weeks',
          desc: 'A full account diagnosis: structure, audiences, creative, tracking and wasted spend, with the fixes ranked.',
          items: [
            'Account and pixel review',
            'Audience and creative audit',
            'Conversion tracking check',
            'Wasted spend analysis',
            '90-day plan, in writing',
          ],
          cta: 'Start with the Meta audit',
          subject: 'Meta audit request',
        },
        {
          jp: '実装',
          name: 'Meta Launch',
          price: '$6,800',
          per: 'One time · 4 weeks',
          desc: 'The restructure shipped: new campaigns, audiences, creative and tracking, launched and reporting.',
          items: [
            'Everything in The Meta Audit',
            'Campaign restructure and build-out',
            'Audience and creative testing',
            'Pixel and conversion tracking',
            'Launch with weekly reporting',
          ],
          cta: 'Book the sprint',
          subject: 'Meta launch request',
        },
        {
          jp: '計測',
          name: 'Meta Retainer',
          price: '$2,900',
          per: 'Per month · 6-month minimum',
          desc: 'Managed spend with weekly optimization, reported against the organic numbers.',
          items: [
            'Weekly optimization cycle',
            'Weekly spend and lead reporting',
            'Creative rotation and testing',
            'Audience expansion',
            'Priority support, same-day answers',
          ],
          cta: 'Talk retainers',
          subject: 'Meta retainer inquiry',
        },
      ],
      optionsNote: 'senior engineers only, weekly written updates, and a straight answer if we are not the right fit.',
      optionsNoteStrong: 'Every option:',
      processLabel: 'Process',
      processHeading: 'How it runs',
      steps: [
        { jp: '監査', title: 'Audit', text: 'We open the account, the audience data and the conversion history, and find where the budget is leaking.' },
        { jp: '設計', title: 'Architecture', text: 'One plan across paid and organic: the same conversion map, named owners and a 90-day flight order.' },
        { jp: '実装', title: 'Build', text: 'Campaigns, creative and tracking shipped in weekly releases you can verify yourself.' },
        { jp: '計測', title: 'Measure', text: 'Spend, cost per lead and return reported weekly, with the organic work compounding alongside.' },
      ],
      auditCta: 'Start with the Meta audit',
      contactLabel: 'Contact',
      contactHeading: 'Turn scroll into revenue.',
      contactSub: 'One email starts it. We reply within one business day with next steps and a straight answer on whether we can help.',
      bookCall: 'Book a strategy call',
      seeOptions: 'See the options',
    },
    'ai-automation': {
      navLabel: 'AI Automation',
      navJp: '自動',
      kicker: 'Service · AI Automation',
      promise: 'Make the busywork run itself',
      hero: ['Automate the', 'repetitive.'],
      sub: 'AI automation and workflow engineering: agents, integrations and internal tools that do the repetitive work, scoped and quoted per project.',
      optionsLabel: 'Scope',
      optionsHeading: 'Quoted to your workflow.',
      optionsLead: 'Every automation project is scoped to your stack and your team, then quoted — no generic packages, no one-size-fits-all.',
      options: [
        {
          jp: '自動',
          name: 'Custom Automation',
          price: 'Quote only',
          per: 'Scoped per project',
          desc: 'Agents, integrations and internal tools that remove repetitive work from your operations.',
          items: [
            'Discovery call and workflow map',
            'Scoped proposal with a fixed price',
            'Built in your stack, with your tools',
            'Handover with docs and training',
            'Support after launch',
          ],
          cta: 'Request a quote',
          subject: 'AI automation quote request',
        },
      ],
      optionsNote: 'a straight answer if we are not the right fit.',
      optionsNoteStrong: 'Every quote:',
      processLabel: 'Process',
      processHeading: 'How it runs',
      steps: [
        { jp: '聞', title: 'Discovery', text: 'A call to map the repetitive work, the tools involved and the measurable outcome you want.' },
        { jp: '見積', title: 'Proposal', text: 'A fixed-price scope with the build plan, the timeline and what success looks like — before any commitment.' },
        { jp: '実装', title: 'Build', text: 'We build in your stack, integrate with your tools and test with real data.' },
        { jp: '渡', title: 'Handover', text: 'Docs, training and support after launch, so the automation runs without us in the room.' },
      ],
      auditCta: 'Request a quote',
      contactLabel: 'Contact',
      contactHeading: 'What should run itself?',
      contactSub: 'One email starts it. We reply within one business day with next steps and a straight answer on whether we can help.',
      bookCall: 'Book a strategy call',
      seeOptions: 'See how it works',
    },
  },
  'pt-BR': {
    'technical-seo': {
      navLabel: 'SEO técnico e local',
      navJp: '技術',
      kicker: 'Serviço · SEO técnico e local',
      promise: 'A classificação começa no código',
      hero: ['SEO técnico', 'e local.'],
      sub: 'Arquitetura de rastreamento, Core Web Vitals, dados estruturados e controle de indexação, corrigidos onde o problema realmente está: no código.',
      optionsLabel: 'Opções',
      optionsHeading: 'Escolha como começar.',
      optionsLead:
        'Cinco formas de começar, um padrão de trabalho. Toda opção termina com correções que você mesmo consegue verificar, não um PDF de recomendações.',
      options: [
        {
          jp: '監査',
          name: 'A Auditoria',
          price: '$2,400',
          per: 'Pagamento único · 2 semanas',
          desc: 'Um diagnóstico técnico completo com uma lista priorizada de correções, para você saber exatamente o que está te bloqueando e em que ordem atacar.',
          items: [
            'Rastreamento completo e análise de logs',
            'Relatório de Core Web Vitals, página por página',
            'Revisão de dados estruturados e indexação',
            'Lista priorizada com estimativas de esforço',
            'Roteiro de 90 dias, por escrito',
          ],
          cta: 'Começar com a auditoria',
          subject: 'Audit request',
        },
        {
          jp: '実装',
          name: 'Sprint de Correções',
          price: '$6,800',
          per: 'Pagamento único · 4 semanas',
          desc: 'A auditoria, mais mãos no teclado. Implementamos as correções no seu stack e re-rastreamos para provar que os números mudaram.',
          items: [
            'Tudo o que está na Auditoria',
            'Implementamos as correções no seu código',
            'Engenharia de velocidade até vitais verdes',
            'Schema escrito e implantado',
            'Verificação antes/depois com novo rastreamento',
          ],
          cta: 'Agendar o sprint',
          subject: 'Fix sprint request',
        },
        {
          jp: '計測',
          name: 'Mensal',
          price: '$2,900',
          per: 'Por mês · mínimo de 6 meses',
          desc: 'Acompanhamento técnico contínuo: monitoramento, releases mensais e alertas de regressão, para os ganhos continuarem ganhos.',
          items: [
            'Monitoramento 24/7 de uptime e rastreamento',
            'Ciclo mensal de releases técnicos',
            'Alertas de regressão antes de cair no ranking',
            'Revisão estratégica trimestral',
            'Suporte prioritário, respostas no mesmo dia',
          ],
          cta: 'Falar sobre mensalidade',
          subject: 'Retainer inquiry',
        },
        {
          jp: '設計',
          name: 'Desenvolvimento de Conteúdo',
          price: '$3,500',
          per: 'Por mês · mínimo de 3 meses',
          desc: 'Páginas, artigos e textos de serviço escritos para responder às perguntas que seus compradores realmente fazem, estruturados para crawlers e motores de IA entenderem.',
          items: [
            'Briefings de página answer-first',
            'Conteúdo escrito e editado',
            'Linkagem interna embutida',
            'Schema em cada página',
            'Ciclo mensal de publicação',
          ],
          cta: 'Começar com conteúdo',
          subject: 'Content development request',
        },
        {
          jp: '検索',
          name: 'Backlinks',
          price: '$1,900',
          per: 'Por mês · mínimo de 3 meses',
          desc: 'Autoridade conquistada de sites que importam: divulgação, relações públicas digitais e ativos linkáveis, com fonte e justificativa reportadas para cada colocação.',
          items: [
            'Produção de ativos linkáveis',
            'Divulgação e relações públicas digitais',
            'Colocação com justificativa para cada uma',
            'Limpeza de links tóxicos',
            'Relatório mensal de autoridade',
          ],
          cta: 'Começar com link building',
          subject: 'Backlinks request',
        },
      ],
      optionsNote: 'apenas engenheiros seniores, atualizações semanais por escrito e uma resposta direta se não formos a escolha certa.',
      optionsNoteStrong: 'Toda opção:',
      processLabel: 'Processo',
      processHeading: 'Como o trabalho acontece',
      steps: [
        { jp: '監査', title: 'Diagnóstico', text: 'Entendemos sua oferta, cidades, concorrência e os bloqueios técnicos que impedem sua empresa de aparecer.' },
        { jp: '設計', title: 'Plano', text: 'Um plano priorizado com responsáveis, impacto esperado e a ordem de execução. Você aprova antes de mexermos em qualquer coisa.' },
        { jp: '実装', title: 'Implementação', text: 'Código, conteúdo, páginas e campanhas em ciclos semanais que você consegue acompanhar.' },
        { jp: '計測', title: 'Medição', text: 'Visibilidade, contatos e oportunidades acompanhados com clareza, junto das próximas decisões.' },
      ],
      auditCta: 'Comece com um diagnóstico',
      contactLabel: 'Contato',
      contactHeading: 'Pare de perder clientes para quem aparece primeiro.',
      contactSub: 'Um e-mail começa tudo. Respondemos em até um dia útil com os próximos passos e uma resposta direta sobre se podemos ajudar.',
      bookCall: 'Agendar uma conversa',
      seeOptions: 'Ver as opções',
    },
    geo: {
      navLabel: 'GEO',
      navJp: '生成',
      kicker: 'Serviço · GEO',
      promise: 'Seja citado pelos motores de resposta',
      hero: ['Seja a', 'resposta.'],
      sub: 'Otimização para Motores Generativos (GEO). Estruturamos seu conteúdo, entidades e sinais de autoridade para ChatGPT, Perplexity e AI Overviews do Google citarem você pelo nome quando seus compradores perguntam.',
      optionsLabel: 'Opções',
      optionsHeading: 'Entre na resposta, não fique embaixo dela.',
      optionsLead:
        'Três formas de começar. Toda opção termina com citações que você mesmo consegue buscar e verificar, não um relatório de recomendações.',
      options: [
        {
          jp: '監査',
          name: 'Auditoria de Citações',
          price: '$2,400',
          per: 'Pagamento único · 2 semanas',
          desc: 'Onde os motores de resposta já te citam, onde deveriam e exatamente o que está bloqueando.',
          items: [
            'Mapa de entidades e menções à marca',
            'Auditoria de citações nos motores de resposta',
            'Comparação de citações com concorrentes',
            'Plano priorizado de conteúdo e entidades',
            'Roteiro de 90 dias, por escrito',
          ],
          cta: 'Começar com a auditoria de citações',
          subject: 'Citation audit request',
        },
        {
          jp: '実装',
          name: 'Sprint de Citações',
          price: '$6,800',
          per: 'Pagamento único · 4 semanas',
          desc: 'A auditoria mais a construção: páginas de entidade, conteúdo answer-first e llms.txt, entregues e re-verificados.',
          items: [
            'Tudo o que está na Auditoria de Citações',
            'Páginas de entidade e schema implantados',
            'Conteúdo answer-first escrito',
            'llms.txt e feeds legíveis por máquinas',
            'Re-verificação de citações antes/depois',
          ],
          cta: 'Agendar o sprint',
          subject: 'Citation sprint request',
        },
        {
          jp: '計測',
          name: 'Mensal de Visibilidade',
          price: '$2,900',
          per: 'Por mês · mínimo de 6 meses',
          desc: 'Trabalho contínuo de entidades e conteúdo para sua participação em citações crescer e se manter.',
          items: [
            'Releases mensais de conteúdo e entidades',
            'Acompanhamento da participação em citações',
            'Monitoramento de novas perguntas',
            'Revisão estratégica trimestral',
            'Suporte prioritário, respostas no mesmo dia',
          ],
          cta: 'Falar sobre mensalidade',
          subject: 'Visibility retainer inquiry',
        },
      ],
      optionsNote: 'apenas engenheiros seniores, atualizações semanais por escrito e uma resposta direta se não formos a escolha certa.',
      optionsNoteStrong: 'Toda opção:',
      processLabel: 'Processo',
      processHeading: 'Como o trabalho acontece',
      steps: [
        { jp: '監査', title: 'Diagnóstico', text: 'Mapeamos suas entidades, citações existentes e onde os motores de resposta já mencionam você, e onde deveriam.' },
        { jp: '設計', title: 'Plano', text: 'Um mapa de entidades e conteúdo: as perguntas que os compradores fazem, quem responde hoje e a página que deve ser dona de cada resposta.' },
        { jp: '実装', title: 'Implementação', text: 'Escrevemos e estruturamos as respostas, implantamos o schema e publicamos o llms.txt para seu conteúdo ser legível por máquinas.' },
        { jp: '計測', title: 'Medição', text: 'Participação em citações em ChatGPT, Perplexity e AI Overviews, reportada mensalmente em linguagem simples.' },
      ],
      auditCta: 'Comece com a auditoria de citações',
      contactLabel: 'Contato',
      contactHeading: 'Seja o nome que os motores de resposta citam.',
      contactSub: 'Um e-mail começa tudo. Respondemos em até um dia útil com os próximos passos e uma resposta direta sobre se podemos ajudar.',
      bookCall: 'Agendar uma conversa',
      seeOptions: 'Ver as opções',
    },
    'web-development': {
      navLabel: 'Sites e landing pages',
      navJp: '開発',
      kicker: 'Serviço · Sites e landing pages',
      promise: 'Sites construídos para ranquear desde o primeiro commit',
      hero: ['Construído', 'para ranquear.'],
      sub: 'Construções em Next.js e Astro onde orçamentos de performance, HTML semântico e dados estruturados são requisitos, não reflexões tardias. Migrações que preservam cada ranking que você já conquistou.',
      optionsLabel: 'Opções',
      optionsHeading: 'Construa certo, ranqueie desde o dia um.',
      optionsLead:
        'Três formas de engajar, um padrão de trabalho. Toda construção entrega orçamentos de performance, HTML semântico e dados estruturados incluídos.',
      options: [
        {
          jp: '監査',
          name: 'Auditoria de Build',
          price: '$2,400',
          per: 'Pagamento único · 2 semanas',
          desc: 'Um diagnóstico técnico do seu site ou stack atual, com a lista de correções e as opções de reconstrução precificadas.',
          items: [
            'Revisão de performance e vitals',
            'Auditoria de indexação e schema',
            'Avaliação de stack e CMS',
            'Recomendação entre reconstruir ou corrigir',
            'Orçamento com estimativas de esforço',
          ],
          cta: 'Começar com a auditoria de build',
          subject: 'Build audit request',
        },
        {
          jp: '実装',
          name: 'Sprint de Build',
          price: '$6,800',
          per: 'Pagamento único · 4 semanas',
          desc: 'Design e construção de um site de marketing focado, projetado para ranquear desde o lançamento.',
          items: [
            'Tudo o que está na Auditoria de Build',
            'Design e construção de front-end',
            'Orçamento de performance cumprido',
            'HTML semântico e schema embutidos',
            'Configuração de CMS headless',
          ],
          cta: 'Agendar o sprint',
          subject: 'Build sprint request',
        },
        {
          jp: '計測',
          name: 'Mensal de Build',
          price: '$2,900',
          per: 'Por mês · mínimo de 6 meses',
          desc: 'Desenvolvimento contínuo após o lançamento: releases, experimentos e iteração de conversão.',
          items: [
            'Ciclo mensal de releases',
            'Iteração de conversão e experimentos',
            'Monitoramento de vitals e uptime',
            'Construção de conteúdo e landing pages',
            'Suporte prioritário, respostas no mesmo dia',
          ],
          cta: 'Falar sobre mensalidade',
          subject: 'Build retainer inquiry',
        },
      ],
      optionsNote: 'apenas engenheiros seniores, atualizações semanais por escrito e uma resposta direta se não formos a escolha certa.',
      optionsNoteStrong: 'Toda opção:',
      processLabel: 'Processo',
      processHeading: 'Como o trabalho acontece',
      steps: [
        { jp: '監査', title: 'Diagnóstico', text: 'Revisamos seu stack, seus Core Web Vitals e sua indexação da forma como um crawler faria.' },
        { jp: '設計', title: 'Plano', text: 'Um plano de build com orçamentos de performance, HTML semântico e dados estruturados travados antes de escrever uma linha.' },
        { jp: '実装', title: 'Implementação', text: 'Design, código e CMS em releases semanais. Você consegue ver o site ranqueando antes do lançamento.' },
        { jp: '計測', title: 'Medição', text: 'Vitals, indexação e rankings acompanhados desde o lançamento, reportados mensalmente em linguagem simples.' },
      ],
      auditCta: 'Comece com a auditoria de build',
      contactLabel: 'Contato',
      contactHeading: 'Sites que ranqueiam desde o primeiro commit.',
      contactSub: 'Um e-mail começa tudo. Respondemos em até um dia útil com os próximos passos e uma resposta direta sobre se podemos ajudar.',
      bookCall: 'Agendar uma conversa',
      seeOptions: 'Ver as opções',
    },
    'paid-search': {
      navLabel: 'Google Ads',
      navJp: '広告',
      kicker: 'Serviço · Google Ads',
      promise: 'Compre os cliques que você ainda não consegue ganhar',
      hero: ['Seja dono', 'dos cliques.'],
      sub: 'Google Ads gerenciado contra o mesmo mapa de palavras-chave da sua estratégia orgânica. Um plano, dois canais, sem gasto desperdiçado enquanto o trabalho orgânico compõe.',
      optionsLabel: 'Opções',
      optionsHeading: 'Gasto que compõe, não queima.',
      optionsLead:
        'Três formas de começar. Toda opção roda no mesmo mapa de palavras-chave da sua estratégia orgânica, para os canais se reforçarem.',
      options: [
        {
          jp: '監査',
          name: 'Auditoria de Conta',
          price: '$2,400',
          per: 'Pagamento único · 2 semanas',
          desc: 'Um diagnóstico completo da conta: estrutura, palavras-chave, landing pages e gasto desperdiçado, com as correções priorizadas.',
          items: [
            'Revisão da estrutura da conta',
            'Mapa de palavras-chave e tipos de correspondência',
            'Análise de gasto desperdiçado',
            'Avaliação de landing pages',
            'Plano de 90 dias, por escrito',
          ],
          cta: 'Começar com a auditoria de conta',
          subject: 'Account audit request',
        },
        {
          jp: '実装',
          name: 'Sprint de Lançamento',
          price: '$6,800',
          per: 'Pagamento único · 4 semanas',
          desc: 'A reestruturação entregue: nova arquitetura de conta, campanhas, landing pages e rastreamento.',
          items: [
            'Tudo o que está na Auditoria de Conta',
            'Reestruturação e construção da conta',
            'Landing pages escritas e construídas',
            'Feeds e rastreamento de conversões',
            'Lançamento com relatórios semanais',
          ],
          cta: 'Agendar o sprint',
          subject: 'Launch sprint request',
        },
        {
          jp: '計測',
          name: 'Mensal de Mídia',
          price: '$2,900',
          per: 'Por mês · mínimo de 6 meses',
          desc: 'Gasto gerenciado com otimização semanal, reportado contra os números orgânicos.',
          items: [
            'Ciclo semanal de otimização',
            'Relatórios semanais de gasto e leads',
            'Gestão de lances e orçamento',
            'Expansão de novas palavras-chave',
            'Suporte prioritário, respostas no mesmo dia',
          ],
          cta: 'Falar sobre mensalidade',
          subject: 'Paid retainer inquiry',
        },
      ],
      optionsNote: 'apenas engenheiros seniores, atualizações semanais por escrito e uma resposta direta se não formos a escolha certa.',
      optionsNoteStrong: 'Toda opção:',
      processLabel: 'Processo',
      processHeading: 'Como o trabalho acontece',
      steps: [
        { jp: '監査', title: 'Diagnóstico', text: 'Abrimos a conta, o mapa de palavras-chave e os dados de conversão, e encontramos onde o orçamento está vazando.' },
        { jp: '設計', title: 'Plano', text: 'Um plano para pago e orgânico: o mesmo mapa de palavras-chave, responsáveis definidos e uma ordem de 90 dias.' },
        { jp: '実装', title: 'Implementação', text: 'Reestruturação de conta, landing pages e feeds entregues em releases semanais que você mesmo verifica.' },
        { jp: '計測', title: 'Medição', text: 'Gasto, posição e custo por lead reportados semanalmente, com o trabalho orgânico compondo ao lado.' },
      ],
      auditCta: 'Comece com a auditoria de conta',
      contactLabel: 'Contato',
      contactHeading: 'Transforme gasto em rankings que são seus.',
      contactSub: 'Um e-mail começa tudo. Respondemos em até um dia útil com os próximos passos e uma resposta direta sobre se podemos ajudar.',
      bookCall: 'Agendar uma conversa',
      seeOptions: 'Ver as opções',
    },
    'meta-ads': {
      navLabel: 'Meta Ads',
      navJp: '広告',
      kicker: 'Serviço · Meta Ads',
      promise: 'Compre a atenção que você ainda não consegue ganhar',
      hero: ['Alcance', 'que converte.'],
      sub: 'Campanhas no Facebook e Instagram gerenciadas contra os mesmos dados de palavras-chave e conversão da sua estratégia orgânica. Públicos, criativos e orçamento em um plano, sem desperdício.',
      optionsLabel: 'Opções',
      optionsHeading: 'Gaste onde estão os olhos.',
      optionsLead:
        'Três formas de começar. Toda opção roda nos mesmos dados de conversão e público do restante da sua estratégia, para os canais se reforçarem.',
      options: [
        {
          jp: '監査',
          name: 'Auditoria Meta',
          price: '$2,400',
          per: 'Pagamento único · 2 semanas',
          desc: 'Um diagnóstico completo da conta: estrutura, públicos, criativos, rastreamento e gasto desperdiçado, com as correções priorizadas.',
          items: [
            'Revisão de conta e pixel',
            'Auditoria de públicos e criativos',
            'Verificação do rastreamento de conversões',
            'Análise de gasto desperdiçado',
            'Plano de 90 dias, por escrito',
          ],
          cta: 'Começar com a auditoria Meta',
          subject: 'Meta audit request',
        },
        {
          jp: '実装',
          name: 'Sprint Meta',
          price: '$6,800',
          per: 'Pagamento único · 4 semanas',
          desc: 'A reestruturação entregue: novas campanhas, públicos, criativos e rastreamento, lançados e reportando.',
          items: [
            'Tudo o que está na Auditoria Meta',
            'Reestruturação e construção de campanhas',
            'Testes de públicos e criativos',
            'Pixel e rastreamento de conversões',
            'Lançamento com relatórios semanais',
          ],
          cta: 'Agendar o sprint',
          subject: 'Meta launch request',
        },
        {
          jp: '計測',
          name: 'Mensal Meta',
          price: '$2,900',
          per: 'Por mês · mínimo de 6 meses',
          desc: 'Gasto gerenciado com otimização semanal, reportado contra os números orgânicos.',
          items: [
            'Ciclo semanal de otimização',
            'Relatórios semanais de gasto e leads',
            'Rotação e testes de criativos',
            'Expansão de públicos',
            'Suporte prioritário, respostas no mesmo dia',
          ],
          cta: 'Falar sobre mensalidade',
          subject: 'Meta retainer inquiry',
        },
      ],
      optionsNote: 'apenas engenheiros seniores, atualizações semanais por escrito e uma resposta direta se não formos a escolha certa.',
      optionsNoteStrong: 'Toda opção:',
      processLabel: 'Processo',
      processHeading: 'Como o trabalho acontece',
      steps: [
        { jp: '監査', title: 'Diagnóstico', text: 'Abrimos a conta, os dados de público e o histórico de conversões, e encontramos onde o orçamento está vazando.' },
        { jp: '設計', title: 'Plano', text: 'Um plano para pago e orgânico: o mesmo mapa de conversões, responsáveis definidos e uma ordem de 90 dias.' },
        { jp: '実装', title: 'Implementação', text: 'Campanhas, criativos e rastreamento entregues em releases semanais que você mesmo verifica.' },
        { jp: '計測', title: 'Medição', text: 'Gasto, custo por lead e retorno reportados semanalmente, com o trabalho orgânico compondo ao lado.' },
      ],
      auditCta: 'Comece com a auditoria Meta',
      contactLabel: 'Contato',
      contactHeading: 'Transforme o scroll em receita.',
      contactSub: 'Um e-mail começa tudo. Respondemos em até um dia útil com os próximos passos e uma resposta direta sobre se podemos ajudar.',
      bookCall: 'Agendar uma conversa',
      seeOptions: 'Ver as opções',
    },
    'ai-automation': {
      navLabel: 'Automação com IA',
      navJp: '自動',
      kicker: 'Serviço · Automação com IA',
      promise: 'Deixe o trabalho repetitivo rodar sozinho',
      hero: ['Automatize o', 'repetitivo.'],
      sub: 'Automação com IA e engenharia de fluxos: agentes, integrações e ferramentas internas que eliminam o trabalho repetitivo — escopados e orçados sob consulta.',
      optionsLabel: 'Escopo',
      optionsHeading: 'Orçado para o seu fluxo.',
      optionsLead: 'Todo projeto de automação é escopado para o seu stack e o seu time, e então orçado — sem pacotes genéricos, sem tamanho único.',
      options: [
        {
          jp: '自動',
          name: 'Automação Sob Medida',
          price: 'Sob consulta',
          per: 'Escopado por projeto',
          desc: 'Agentes, integrações e ferramentas internas que removem trabalho repetitivo das suas operações.',
          items: [
            'Chamada de descoberta e mapa de fluxos',
            'Proposta escopada com preço fechado',
            'Construído no seu stack, com as suas ferramentas',
            'Entrega com documentação e treinamento',
            'Suporte após o lançamento',
          ],
          cta: 'Solicitar orçamento',
          subject: 'AI automation quote request',
        },
      ],
      optionsNote: 'uma resposta direta se não formos a escolha certa.',
      optionsNoteStrong: 'Todo orçamento:',
      processLabel: 'Processo',
      processHeading: 'Como o trabalho acontece',
      steps: [
        { jp: '聞', title: 'Descoberta', text: 'Uma chamada para mapear o trabalho repetitivo, as ferramentas envolvidas e o resultado mensurável que você quer.' },
        { jp: '見積', title: 'Proposta', text: 'Um escopo com preço fechado: plano de construção, cronograma e o que é sucesso — antes de qualquer compromisso.' },
        { jp: '実装', title: 'Construção', text: 'Construímos no seu stack, integramos com as suas ferramentas e testamos com dados reais.' },
        { jp: '渡', title: 'Entrega', text: 'Documentação, treinamento e suporte após o lançamento, para a automação rodar sem a nossa presença.' },
      ],
      auditCta: 'Solicitar orçamento',
      contactLabel: 'Contato',
      contactHeading: 'O que deveria rodar sozinho?',
      contactSub: 'Um e-mail começa tudo. Respondemos em até um dia útil com os próximos passos e uma resposta direta sobre se podemos ajudar.',
      bookCall: 'Agendar uma conversa',
      seeOptions: 'Veja como funciona',
    },
  },
}

export function serviceForPath(pathname: string): ServiceId | undefined {
  // Only the two real namespaces resolve: /services/<slug> (en-US) and
  // /pt-br/servicos/<slug> (pt-BR). Mixed forms like /pt-br/services/x or
  // /servicos/x must not resolve to a service.
  const match = /^\/(?:pt-br\/servicos|services)\/([a-z-]+)$/.exec(normalizePath(pathname))
  if (!match) return undefined
  const id = match[1] as ServiceId
  return SERVICE_IDS.includes(id) ? id : undefined
}

export function serviceNavigation(locale: Locale) {
  return SERVICE_IDS.map((id) => ({
    id,
    to: SERVICE_ROUTES[id][locale],
    label: SERVICE_CONTENT[locale][id].navLabel,
    jp: SERVICE_CONTENT[locale][id].navJp,
  }))
}
