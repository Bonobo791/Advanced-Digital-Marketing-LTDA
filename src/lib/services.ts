import type { Locale } from '$lib/locale'
import { normalizePath } from './path.ts'
import { isServiceId, type CatalogServiceId } from './catalog'
import { C, L, resolveCopy, type CopySource } from './localized-copy'

export const SERVICE_IDS = ['technical-seo', 'geo', 'web-development', 'paid-search', 'meta-ads', 'ai-automation'] as const
export type ServiceId = (typeof SERVICE_IDS)[number]

export type ServiceOption = {
  flag?: string
  jp: string
  name: string
  /** Price in BRL — the site's authoritative currency. en-US renders the USD
   *  reference at the catalog's 5:1 rate (BRL_USD_REFERENCE_RATE). `null`
   *  means no fixed price and renders `priceLabel` instead (e.g. 'Free'). */
  priceBRL: number | null
  /** Locale label rendered when priceBRL is null (e.g. 'Free', 'Quote only'). */
  priceLabel?: string
  per: string
  desc: string
  items: string[]
  cta: string
  subject: string
  /** Same-page pricing/checkout section this CTA scrolls to (e.g. '#subscribe').
   *  Unset falls back to the service default and then to the contact form.
   *  Explicit `null` forces the contact form — for one-time/free options that
   *  have no pricing section and must never land on the recurring checkout. */
  pricingAnchor?: string | null
  /** Catalog subscription this option's CTA preselects in the configurator
   *  (e.g. Technical SEO's per-option CTAs), so clicking one option never
   *  seeds a package that includes the others. */
  preselect?: CatalogServiceId
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
  /** Default pricing section anchor for this service's option CTAs (e.g.
   *  '#subscribe'). Services without a pricing section keep mailto CTAs. */
  pricingAnchor?: string
}

/**
 * Contact-route href that carries the option's subject so the owner
 * notification can name the requested service (validated server-side).
 */
export function contactHref(contactRoute: string, subject: string | undefined): string {
  return subject ? `${contactRoute}?subject=${encodeURIComponent(subject)}` : contactRoute
}

/**
 * Single source of truth for an option CTA's destination — used by
 * `ServicePage.svelte` and pinned by `services.unit.test.ts` so the resolved
 * behavior (not the raw data field) is what the tests guard:
 *  - explicit `pricingAnchor: null` → the contact form (with `?subject=` when
 *    the option carries one);
 *  - an explicit anchor → that anchor;
 *  - otherwise the service-level default anchor, or the contact form when the
 *    service has none.
 */
export function resolveOptionCtaHref(
  option: Pick<ServiceOption, 'pricingAnchor'> & { subject?: string; preselect?: CatalogServiceId },
  service: Pick<ServiceContent, 'pricingAnchor'>,
  contactRoute: string,
): string {
  // Explicit `null` must NOT inherit the service default (one-time options
  // force the contact form), so the ternary cannot be replaced with `??` —
  // nullish coalescing would collapse explicit null into the service default.
  const anchor = option.pricingAnchor === null ? null : option.pricingAnchor ?? service.pricingAnchor ?? null
  if (anchor === null) return contactHref(contactRoute, option.subject)
  // An option that must seed the configurator with ONLY the clicked service
  // carries it in the URL (?preselect=…), which ServicePage reads to override
  // the service-level default preselect set.
  if (option.preselect) return `?preselect=${encodeURIComponent(option.preselect)}#${anchor.slice(1)}`
  return anchor
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

/** Override the default package only with a recurring offer from this page. */
export function resolveServicePreselect(service: ServiceId, raw: string | null): CatalogServiceId[] {
  const offers = SERVICE_SUBSCRIPTIONS[service]
  return raw && isServiceId(raw) && offers.includes(raw) ? [raw] : offers
}

// ─── Copy tables ────────────────────────────────────────────────────────────
//
// Copy is declared ONCE per leaf with L(en, pt) / C(shared) from
// localized-copy.ts and resolved into the plain per-locale records below —
// the two parallel locale literals this replaces are what the SonarCloud
// duplication gate flagged (7.9% > 3%). Each option/step group is its own
// named constant so no two service declarations repeat the same structure
// inline. SERVICE_META / SERVICE_CONTENT keep their exact public shapes.

type ServiceMeta = { title: string; description: string }

const SERVICE_META_SOURCE: CopySource<Record<ServiceId, ServiceMeta>> = {
  'technical-seo': {
    title: L('Technical SEO Services | Implementation and QA | ADM', 'SEO técnico e local | Diagnóstico e implementação | ADM'),
    description: L(
      'Identify crawl, rendering, indexing, template, and content-planning issues. Get a scoped path from diagnosis to implementation and validation.',
      'Investigue rastreamento, renderização, indexação e URLs canônicas. Defina o escopo, os responsáveis e como validar mudanças de SEO técnico.',
    ),
  },
  geo: {
    title: L('Advanced Digital Marketing LTDA | GEO', 'Advanced Digital Marketing LTDA | GEO e visibilidade em IA'),
    description: L(
      'GEO by Advanced Digital Marketing: entity mapping, answer-first content and citation tracking that get you quoted by ChatGPT, Perplexity and Google AI Overviews.',
      'GEO pela Advanced Digital Marketing: mapeamento de entidades, conteúdo answer-first e rastreamento de citações para você ser citado pelo nome no ChatGPT, Perplexity e AI Overviews do Google.',
    ),
  },
  'web-development': {
    title: L('Advanced Digital Marketing LTDA | Web Development', 'Advanced Digital Marketing LTDA | Sites e landing pages'),
    description: L(
      'Web development by Advanced Digital Marketing: Next.js and Astro builds where performance budgets, semantic HTML and structured data are built in from the first commit.',
      'Desenvolvimento web pela Advanced Digital Marketing: builds em Next.js e Astro com orçamentos de performance, HTML semântico e dados estruturados embutidos desde o primeiro commit.',
    ),
  },
  'paid-search': {
    title: L('Advanced Digital Marketing LTDA | Paid Search', 'Advanced Digital Marketing LTDA | Google Ads'),
    description: L(
      'Paid search by Advanced Digital Marketing: Google Ads managed against the same keyword map as your organic strategy. One plan, two channels, no wasted spend.',
      'Google Ads pela Advanced Digital Marketing: gerenciado contra o mesmo mapa de palavras-chave da sua estratégia orgânica. Um plano, dois canais, sem gasto desperdiçado.',
    ),
  },
  'meta-ads': {
    title: C('Advanced Digital Marketing LTDA | Meta Ads'),
    description: L(
      'Meta Ads by Advanced Digital Marketing: Facebook and Instagram campaigns managed against the same keyword and conversion data as your organic strategy. One plan, every channel.',
      'Meta Ads pela Advanced Digital Marketing: campanhas no Facebook e Instagram gerenciadas contra os mesmos dados de palavras-chave e conversão da sua estratégia orgânica. Um plano, todos os canais.',
    ),
  },
  'ai-automation': {
    title: L('Advanced Digital Marketing LTDA | AI Automation', 'Advanced Digital Marketing LTDA | Automação com IA'),
    description: L(
      'AI automation by Advanced Digital Marketing: agents, integrations and internal tools that remove repetitive work from your operations — scoped and quoted per project.',
      'Automação com IA pela Advanced Digital Marketing: agentes, integrações e ferramentas internas que removem trabalho repetitivo das suas operações — escopados e orçados sob consulta.',
    ),
  },
}

export const SERVICE_META: Record<Locale, Record<ServiceId, ServiceMeta>> = {
  'en-US': resolveCopy<Record<ServiceId, ServiceMeta>>(SERVICE_META_SOURCE, 'en-US'),
  'pt-BR': resolveCopy<Record<ServiceId, ServiceMeta>>(SERVICE_META_SOURCE, 'pt-BR'),
}

/** Copy shared verbatim across the audit/sprint/retainer service pages. */
const SHARED = {
  optionsLabel: L('Options', 'Opções'),
  optionsNote: L(
    'senior engineers only, weekly written updates, and a straight answer if we are not the right fit.',
    'apenas engenheiros seniores, atualizações semanais por escrito e uma resposta direta se não formos a escolha certa.',
  ),
  optionsNoteStrong: L('Every option:', 'Toda opção:'),
  processLabel: L('Process', 'Processo'),
  processHeading: L('How it runs', 'Como o trabalho acontece'),
  contactLabel: L('Contact', 'Contato'),
  contactSub: L(
    'One email starts it. We reply within one business day with next steps and a straight answer on whether we can help.',
    'Um e-mail começa tudo. Respondemos em até um dia útil com os próximos passos e uma resposta direta sobre se podemos ajudar.',
  ),
  bookCall: L('Book a strategy call', 'Agendar uma conversa'),
  seeOptions: L('See the options', 'Ver as opções'),
  flagMostChosen: L('Most chosen', 'Mais escolhido'),
  perTwoWeeks: L('One time · 2 weeks', 'Pagamento único · 2 semanas'),
  perFourWeeks: L('One time · 4 weeks', 'Pagamento único · 4 semanas'),
  perSixMonths: L('Per month · 6-month minimum', 'Por mês · mínimo de 6 meses'),
  ctaBookSprint: L('Book the sprint', 'Agendar o sprint'),
  ctaTalkRetainers: L('Talk retainers', 'Falar sobre mensalidade'),
  itemRoadmap90: L('90-day roadmap, in writing', 'Roteiro de 90 dias, por escrito'),
  itemWastedSpend: L('Wasted spend analysis', 'Análise de gasto desperdiçado'),
  itemPrioritySupport: L('Priority support, same-day answers', 'Suporte prioritário, respostas no mesmo dia'),
  itemWeeklyReports: L('Weekly spend and lead reporting', 'Relatórios semanais de gasto e leads'),
  stepTitles: {
    audit: L('Audit', 'Diagnóstico'),
    plan: L('Architecture', 'Plano'),
    build: L('Build', 'Implementação'),
    measure: L('Measure', 'Medição'),
  },
} as const

/** Audit → plan → build → measure: the four-step engagement every recurring
 *  service page walks through. The skeleton (jp marks, titles) is identical
 *  everywhere — only the narration differs per service. */
function engagementSteps(
  audit: CopySource<string>,
  plan: CopySource<string>,
  build: CopySource<string>,
  measure: CopySource<string>,
): CopySource<ServiceStep[]> {
  return [
    { jp: C('監査'), title: SHARED.stepTitles.audit, text: audit },
    { jp: C('設計'), title: SHARED.stepTitles.plan, text: plan },
    { jp: C('実装'), title: SHARED.stepTitles.build, text: build },
    { jp: C('計測'), title: SHARED.stepTitles.measure, text: measure },
  ]
}

/** The four engagement services offer the same 4-week, R$6,800 sprint: a
 *  one-time engagement with no catalog entry. Services that HAVE a pricing
 *  section add `pricingAnchor: null` at the call site so the sprint CTA stays
 *  in the contact flow instead of scrolling to an unrelated checkout. */
function sprintOption(
  name: CopySource<string>,
  desc: CopySource<string>,
  items: CopySource<string>[],
  subject: CopySource<string>,
): CopySource<ServiceOption> {
  return {
    flag: SHARED.flagMostChosen,
    jp: C('実装'),
    name,
    priceBRL: 6800,
    per: SHARED.perFourWeeks,
    desc,
    items,
    cta: SHARED.ctaBookSprint,
    subject,
  }
}

/** The four engagement services offer the same R$2,900/month retainer
 *  (6-month minimum). Fixed-price retainers are not catalog products, so the
 *  CTA stays in the contact flow with its subject. */
function retainerOption(
  name: CopySource<string>,
  desc: CopySource<string>,
  items: CopySource<string>[],
  subject: CopySource<string>,
): CopySource<ServiceOption> {
  return {
    jp: C('計測'),
    name,
    priceBRL: 2900,
    per: SHARED.perSixMonths,
    desc,
    items,
    cta: SHARED.ctaTalkRetainers,
    subject,
    pricingAnchor: null,
  }
}

// ── technical-seo ───────────────────────────────────────────────────────────

const TECHNICAL_SEO_OPTIONS: CopySource<ServiceOption[]> = [
  {
    jp: C('監査'),
    name: L('The Audit', 'A Auditoria'),
    priceBRL: null,
    priceLabel: L('Free', 'Grátis'),
    per: L('No strings attached', 'Sem compromisso'),
    desc: L(
      'A complete technical diagnosis with a prioritized fix list, so you know exactly what is blocking you and in what order to attack it.',
      'Um diagnóstico técnico completo com uma lista priorizada de correções, para você saber exatamente o que está te bloqueando e em que ordem atacar.',
    ),
    items: [
      L('Full crawl and log-file analysis', 'Rastreamento completo e análise de logs'),
      L('Core Web Vitals report, page by page', 'Relatório de Core Web Vitals, página por página'),
      L('Structured data and indexation review', 'Revisão de dados estruturados e indexação'),
      L('Prioritized fix list with effort estimates', 'Lista priorizada com estimativas de esforço'),
      SHARED.itemRoadmap90,
    ],
    cta: L('Start with the audit', 'Começar com a auditoria'),
    subject: C('Audit request'),
    pricingAnchor: null,
  },
  {
    flag: SHARED.flagMostChosen,
    jp: C('設計'),
    name: L('Content Development', 'Desenvolvimento de Conteúdo'),
    priceBRL: 2000,
    per: L('Per month · no minimum term', 'Por mês · sem prazo mínimo'),
    desc: L(
      'Four articles each month, planned around your buyers’ questions, with writing, on-page editing, and internal links. No minimum term.',
      'Quatro artigos por mês, planejados para responder às dúvidas dos seus compradores, com redação, edição on-page e links internos. Sem prazo mínimo.',
    ),
    items: [
      L('4 articles per month', '4 artigos por mês'),
      L('Answer-first page briefs', 'Briefings de página answer-first'),
      L('On-page content written and edited', 'Conteúdo escrito e editado'),
      L('Internal linking built in', 'Linkagem interna embutida'),
      L('Schema attached to every page', 'Schema em cada página'),
      L('Monthly publishing cycle', 'Ciclo mensal de publicação'),
    ],
    cta: L('Start content development', 'Começar com conteúdo'),
    subject: C('Content development request'),
    // Clicking one option must seed the configurator with ONLY that
    // service — the service default preselects both SEO options.
    preselect: C('seo-content'),
  },
  {
    jp: C('検索'),
    name: C('Backlinks'),
    priceBRL: 3000,
    per: L('Per month · 3-month minimum', 'Por mês · mínimo de 3 meses'),
    desc: L(
      'Authority earned from sites that matter: outreach, digital PR and linkable assets, with the source and the rationale reported for every placement.',
      'Autoridade conquistada de sites que importam: divulgação, relações públicas digitais e ativos linkáveis, com fonte e justificativa reportadas para cada colocação.',
    ),
    items: [
      L('Linkable asset production', 'Produção de ativos linkáveis'),
      L('Outreach and digital PR', 'Divulgação e relações públicas digitais'),
      L('Placement with rationale for each', 'Colocação com justificativa para cada uma'),
      L('Toxic link cleanup', 'Limpeza de links tóxicos'),
      L('Monthly authority report', 'Relatório mensal de autoridade'),
    ],
    cta: L('Start link building', 'Começar com link building'),
    subject: C('Backlinks request'),
    preselect: C('backlinks'),
  },
]

// Exported: the homepage process section reuses these exact steps (constants.ts).
export const TECHNICAL_SEO_STEPS: CopySource<ServiceStep[]> = engagementSteps(
  L(
    'Two weeks inside your data. We map every query you should own and everything blocking it.',
    'Entendemos sua oferta, cidades, concorrência e os bloqueios técnicos que impedem sua empresa de aparecer.',
  ),
  L(
    'A 90-day plan with named owners, projected impact and the order of operations. You approve it before we touch anything.',
    'Um plano priorizado com responsáveis, impacto esperado e a ordem de execução. Você aprova antes de mexermos em qualquer coisa.',
  ),
  L(
    'We ship. Code, content and campaigns in weekly releases you can verify yourself, not in a monthly PDF.',
    'Código, conteúdo, páginas e campanhas em ciclos semanais que você consegue acompanhar.',
  ),
  L(
    'Rankings, AI citations and revenue, reported monthly in plain English with the next quarter already planned.',
    'Visibilidade, contatos e oportunidades acompanhados com clareza, junto das próximas decisões.',
  ),
)

// ── geo ─────────────────────────────────────────────────────────────────────

const GEO_AUDIT: CopySource<ServiceOption> = {
  jp: C('監査'),
  name: L('The Citation Audit', 'Auditoria de Citações'),
  priceBRL: 2400,
  per: SHARED.perTwoWeeks,
  desc: L(
    'Where the answer engines already quote you, where they should, and exactly what is blocking it.',
    'Onde os motores de resposta já te citam, onde deveriam e exatamente o que está bloqueando.',
  ),
  items: [
    L('Entity and brand mention map', 'Mapa de entidades e menções à marca'),
    L('Answer engine citation audit', 'Auditoria de citações nos motores de resposta'),
    L('Competitor citation comparison', 'Comparação de citações com concorrentes'),
    L('Prioritized content and entity plan', 'Plano priorizado de conteúdo e entidades'),
    SHARED.itemRoadmap90,
  ],
  cta: L('Start with the citation audit', 'Começar com a auditoria de citações'),
  subject: C('Citation audit request'),
}

const GEO_SPRINT: CopySource<ServiceOption> = sprintOption(
  L('Citation Sprint', 'Sprint de Citações'),
  L(
    'The audit plus the build: entity pages, answer-first content and llms.txt, shipped and re-checked.',
    'A auditoria mais a construção: páginas de entidade, conteúdo answer-first e llms.txt, entregues e re-verificados.',
  ),
  [
    L('Everything in The Citation Audit', 'Tudo o que está na Auditoria de Citações'),
    L('Entity pages and schema deployed', 'Páginas de entidade e schema implantados'),
    L('Answer-first content written', 'Conteúdo answer-first escrito'),
    L('llms.txt and machine-readable feeds', 'llms.txt e feeds legíveis por máquinas'),
    L('Before/after citation re-check', 'Re-verificação de citações antes/depois'),
  ],
  C('Citation sprint request'),
)

// GEO has no subscription configurator (SERVICE_SUBSCRIPTIONS is empty), so the
// service default '#subscribe' anchor would scroll to nothing — the builder
// correctly keeps this retainer CTA in the contact flow.
const GEO_RETAINER: CopySource<ServiceOption> = retainerOption(
  L('Visibility Retainer', 'Mensal de Visibilidade'),
  L(
    'Continuous entity and content work so your citation share grows, and holds.',
    'Trabalho contínuo de entidades e conteúdo para sua participação em citações crescer e se manter.',
  ),
  [
    L('Monthly content and entity releases', 'Releases mensais de conteúdo e entidades'),
    L('Citation share tracking', 'Acompanhamento da participação em citações'),
    L('New question monitoring', 'Monitoramento de novas perguntas'),
    L('Quarterly strategy review', 'Revisão estratégica trimestral'),
    SHARED.itemPrioritySupport,
  ],
  C('Visibility retainer inquiry'),
)

const GEO_STEPS: CopySource<ServiceStep[]> = engagementSteps(
  L(
    'We map your entities, your existing citations and where the answer engines already mention you, then find where they should.',
    'Mapeamos suas entidades, citações existentes e onde os motores de resposta já mencionam você, e onde deveriam.',
  ),
  L(
    'An entity and content map: the questions buyers ask, who answers them today, and the page that should own each one.',
    'Um mapa de entidades e conteúdo: as perguntas que os compradores fazem, quem responde hoje e a página que deve ser dona de cada resposta.',
  ),
  L(
    'We write and structure the answers, deploy the schema and ship llms.txt so your content is legible to machines.',
    'Escrevemos e estruturamos as respostas, implantamos o schema e publicamos o llms.txt para seu conteúdo ser legível por máquinas.',
  ),
  L(
    'Citation share across ChatGPT, Perplexity and AI Overviews, reported monthly in plain English.',
    'Participação em citações em ChatGPT, Perplexity e AI Overviews, reportada mensalmente em linguagem simples.',
  ),
)

// ── web-development ─────────────────────────────────────────────────────────

const WEB_AUDIT: CopySource<ServiceOption> = {
  jp: C('監査'),
  name: L('The Build Audit', 'Auditoria de Build'),
  priceBRL: 2400,
  per: SHARED.perTwoWeeks,
  desc: L(
    'A technical diagnosis of your current site or stack, with the fix list and rebuild options priced.',
    'Um diagnóstico técnico do seu site ou stack atual, com a lista de correções e as opções de reconstrução precificadas.',
  ),
  items: [
    L('Performance and vitals review', 'Revisão de performance e vitals'),
    L('Indexation and schema audit', 'Auditoria de indexação e schema'),
    L('Stack and CMS assessment', 'Avaliação de stack e CMS'),
    L('Rebuild vs fix recommendation', 'Recomendação entre reconstruir ou corrigir'),
    L('Budget with effort estimates', 'Orçamento com estimativas de esforço'),
  ],
  cta: L('Start with the build audit', 'Começar com a auditoria de build'),
  subject: C('Build audit request'),
  // One-time diagnostic — there is no pricing section for it in the
  // website-build checkout below, so it must not inherit '#builds'.
  pricingAnchor: null,
}

// One-time engagement — the #builds panel prices the website/ecommerce build
// itself, not this sprint, so pricingAnchor: null keeps its CTA on the form.
const WEB_SPRINT: CopySource<ServiceOption> = {
  ...sprintOption(
    L('Build Sprint', 'Sprint de Build'),
    L(
      'Design and build of a focused marketing site, engineered to rank from launch.',
      'Design e construção de um site de marketing focado, projetado para ranquear desde o lançamento.',
    ),
    [
      L('Everything in The Build Audit', 'Tudo o que está na Auditoria de Build'),
      L('Design and front-end build', 'Design e construção de front-end'),
      L('Performance budget enforced', 'Orçamento de performance cumprido'),
      L('Semantic HTML and schema built in', 'HTML semântico e schema embutidos'),
      L('Headless CMS setup', 'Configuração de CMS headless'),
    ],
    C('Build sprint request'),
  ),
  pricingAnchor: null,
}

// The R$2,900 build retainer has no catalog entry — the #subscribe
// configurator only knows the R$300/mo hosting product, so sending this CTA
// there would let the visitor buy hosting instead. The builder routes the
// fixed-price retainer to the contact form with its subject.
const WEB_RETAINER: CopySource<ServiceOption> = retainerOption(
  L('Build Retainer', 'Mensal de Build'),
  L(
    'Continuous development after launch: releases, experiments and CRO iteration.',
    'Desenvolvimento contínuo após o lançamento: releases, experimentos e iteração de conversão.',
  ),
  [
    L('Monthly release cycle', 'Ciclo mensal de releases'),
    L('CRO iteration and experiments', 'Iteração de conversão e experimentos'),
    L('Vitals and uptime monitoring', 'Monitoramento de vitals e uptime'),
    L('Content and landing page builds', 'Construção de conteúdo e landing pages'),
    SHARED.itemPrioritySupport,
  ],
  C('Build retainer inquiry'),
)

const WEB_STEPS: CopySource<ServiceStep[]> = engagementSteps(
  L(
    'We review your stack, your Core Web Vitals and your indexation the way a search crawler would.',
    'Revisamos seu stack, seus Core Web Vitals e sua indexação da forma como um crawler faria.',
  ),
  L(
    'A build plan with performance budgets, semantic HTML and structured data locked in before a line is written.',
    'Um plano de build com orçamentos de performance, HTML semântico e dados estruturados travados antes de escrever uma linha.',
  ),
  L(
    'Design, code and CMS in weekly releases. You can verify the site ranking before it launches.',
    'Design, código e CMS em releases semanais. Você consegue ver o site ranqueando antes do lançamento.',
  ),
  L(
    'Vitals, indexation and rankings tracked from launch, reported monthly in plain English.',
    'Vitals, indexação e rankings acompanhados desde o lançamento, reportados mensalmente em linguagem simples.',
  ),
)

// ── paid-search ─────────────────────────────────────────────────────────────

const ADS_AUDIT: CopySource<ServiceOption> = {
  jp: C('監査'),
  name: L('The Account Audit', 'Auditoria de Conta'),
  priceBRL: 2400,
  per: SHARED.perTwoWeeks,
  desc: L(
    'A full account diagnosis: structure, keywords, landing pages and wasted spend, with the fixes ranked.',
    'Um diagnóstico completo da conta: estrutura, palavras-chave, landing pages e gasto desperdiçado, com as correções priorizadas.',
  ),
  items: [
    L('Account structure review', 'Revisão da estrutura da conta'),
    L('Keyword and match type map', 'Mapa de palavras-chave e tipos de correspondência'),
    SHARED.itemWastedSpend,
    L('Landing page assessment', 'Avaliação de landing pages'),
    L('90-day plan, in writing', 'Plano de 90 dias, por escrito'),
  ],
  cta: L('Start with the account audit', 'Começar com a auditoria de conta'),
  subject: C('Account audit request'),
  pricingAnchor: null,
}

const ADS_SPRINT: CopySource<ServiceOption> = {
  ...sprintOption(
    L('Launch Sprint', 'Sprint de Lançamento'),
    L(
      'The restructure shipped: new account architecture, campaigns, landing pages and tracking.',
      'A reestruturação entregue: nova arquitetura de conta, campanhas, landing pages e rastreamento.',
    ),
    [
      L('Everything in The Account Audit', 'Tudo o que está na Auditoria de Conta'),
      L('Account restructure and build-out', 'Reestruturação e construção da conta'),
      L('Landing pages written and built', 'Landing pages escritas e construídas'),
      L('Feed and conversion tracking', 'Feeds e rastreamento de conversões'),
      L('Launch with weekly reporting', 'Lançamento com relatórios semanais'),
    ],
    C('Launch sprint request'),
  ),
  pricingAnchor: null,
}

// The R$2,900 fixed-price retainer is not the spend-based 'paid-search'
// catalog product the #subscribe configurator prices (max(10% × spend,
// R$ 500)); routing it there would quote a different product. The builder
// keeps the fixed-price retainer CTA in the contact flow with its subject.
const ADS_RETAINER: CopySource<ServiceOption> = retainerOption(
  L('Paid Retainer', 'Mensal de Mídia'),
  L(
    'Managed spend with weekly optimization, reported against the organic numbers.',
    'Gasto gerenciado com otimização semanal, reportado contra os números orgânicos.',
  ),
  [
    L('Weekly optimization cycle', 'Ciclo semanal de otimização'),
    SHARED.itemWeeklyReports,
    L('Bid and budget management', 'Gestão de lances e orçamento'),
    L('New keyword expansion', 'Expansão de novas palavras-chave'),
    SHARED.itemPrioritySupport,
  ],
  C('Paid retainer inquiry'),
)

const ADS_STEPS: CopySource<ServiceStep[]> = engagementSteps(
  L(
    'We open the account, the keyword map and the conversion data, and find where the budget is leaking.',
    'Abrimos a conta, o mapa de palavras-chave e os dados de conversão, e encontramos onde o orçamento está vazando.',
  ),
  L(
    'One plan across paid and organic: the same keyword map, named owners and a 90-day flight order.',
    'Um plano para pago e orgânico: o mesmo mapa de palavras-chave, responsáveis definidos e uma ordem de 90 dias.',
  ),
  L(
    'Account restructure, landing pages and feeds shipped in weekly releases you can verify yourself.',
    'Reestruturação de conta, landing pages e feeds entregues em releases semanais que você mesmo verifica.',
  ),
  L(
    'Spend, position and cost per lead reported weekly, with the organic work compounding alongside.',
    'Gasto, posição e custo por lead reportados semanalmente, com o trabalho orgânico compondo ao lado.',
  ),
)

// ── meta-ads ────────────────────────────────────────────────────────────────

const META_AUDIT: CopySource<ServiceOption> = {
  jp: C('監査'),
  name: L('The Meta Audit', 'Auditoria Meta'),
  priceBRL: 2400,
  per: SHARED.perTwoWeeks,
  desc: L(
    'A full account diagnosis: structure, audiences, creative, tracking and wasted spend, with the fixes ranked.',
    'Um diagnóstico completo da conta: estrutura, públicos, criativos, rastreamento e gasto desperdiçado, com as correções priorizadas.',
  ),
  items: [
    L('Account and pixel review', 'Revisão de conta e pixel'),
    L('Audience and creative audit', 'Auditoria de públicos e criativos'),
    L('Conversion tracking check', 'Verificação do rastreamento de conversões'),
    SHARED.itemWastedSpend,
    L('90-day plan, in writing', 'Plano de 90 dias, por escrito'),
  ],
  cta: L('Start with the Meta audit', 'Começar com a auditoria Meta'),
  subject: C('Meta audit request'),
  pricingAnchor: null,
}

const META_SPRINT: CopySource<ServiceOption> = {
  ...sprintOption(
    L('Meta Launch', 'Sprint Meta'),
    L(
      'The restructure shipped: new campaigns, audiences, creative and tracking, launched and reporting.',
      'A reestruturação entregue: novas campanhas, públicos, criativos e rastreamento, lançados e reportando.',
    ),
    [
      L('Everything in The Meta Audit', 'Tudo o que está na Auditoria Meta'),
      L('Campaign restructure and build-out', 'Reestruturação e construção de campanhas'),
      L('Audience and creative testing', 'Testes de públicos e criativos'),
      L('Pixel and conversion tracking', 'Pixel e rastreamento de conversões'),
      L('Launch with weekly reporting', 'Lançamento com relatórios semanais'),
    ],
    C('Meta launch request'),
  ),
  pricingAnchor: null,
}

// Fixed-price retainer: same rule as the Paid Retainer — the configurator
// only prices the spend-based meta-ads product.
const META_RETAINER: CopySource<ServiceOption> = retainerOption(
  L('Meta Retainer', 'Mensal Meta'),
  L(
    'Managed spend with weekly optimization, reported against the organic numbers.',
    'Gasto gerenciado com otimização semanal, reportado contra os números orgânicos.',
  ),
  [
    L('Weekly optimization cycle', 'Ciclo semanal de otimização'),
    SHARED.itemWeeklyReports,
    L('Creative rotation and testing', 'Rotação e testes de criativos'),
    L('Audience expansion', 'Expansão de públicos'),
    SHARED.itemPrioritySupport,
  ],
  C('Meta retainer inquiry'),
)

const META_STEPS: CopySource<ServiceStep[]> = engagementSteps(
  L(
    'We open the account, the audience data and the conversion history, and find where the budget is leaking.',
    'Abrimos a conta, os dados de público e o histórico de conversões, e encontramos onde o orçamento está vazando.',
  ),
  L(
    'One plan across paid and organic: the same conversion map, named owners and a 90-day flight order.',
    'Um plano para pago e orgânico: o mesmo mapa de conversões, responsáveis definidos e uma ordem de 90 dias.',
  ),
  L(
    'Campaigns, creative and tracking shipped in weekly releases you can verify yourself.',
    'Campanhas, criativos e rastreamento entregues em releases semanais que você mesmo verifica.',
  ),
  L(
    'Spend, cost per lead and return reported weekly, with the organic work compounding alongside.',
    'Gasto, custo por lead e retorno reportados semanalmente, com o trabalho orgânico compondo ao lado.',
  ),
)

// ── ai-automation ───────────────────────────────────────────────────────────

const AI_STEPS: CopySource<ServiceStep[]> = [
  {
    jp: C('聞'),
    title: L('Discovery', 'Descoberta'),
    text: L(
      'A call to map the repetitive work, the tools involved and the measurable outcome you want.',
      'Uma chamada para mapear o trabalho repetitivo, as ferramentas envolvidas e o resultado mensurável que você quer.',
    ),
  },
  {
    jp: C('見積'),
    title: L('Proposal', 'Proposta'),
    text: L(
      'A fixed-price scope with the build plan, the timeline and what success looks like — before any commitment.',
      'Um escopo com preço fechado: plano de construção, cronograma e o que é sucesso — antes de qualquer compromisso.',
    ),
  },
  {
    jp: C('実装'),
    title: L('Build', 'Construção'),
    text: L(
      'We build in your stack, integrate with your tools and test with real data.',
      'Construímos no seu stack, integramos com as suas ferramentas e testamos com dados reais.',
    ),
  },
  {
    jp: C('渡'),
    title: L('Handover', 'Entrega'),
    text: L(
      'Docs, training and support after launch, so the automation runs without us in the room.',
      'Documentação, treinamento e suporte após o lançamento, para a automação rodar sem a nossa presença.',
    ),
  },
]

// ── assembled service copy ──────────────────────────────────────────────────

const TECHNICAL_SEO_ENTRY: CopySource<ServiceContent> = {
  navLabel: L('Technical SEO', 'SEO técnico e local'),
  navJp: C('技術'),
  kicker: L('Service · Technical SEO', 'Serviço · SEO técnico e local'),
  promise: L('Rankings start at the code level', 'A classificação começa no código'),
  hero: [L('Technical', 'SEO técnico'), L('SEO.', 'e local.')],
  sub: L(
    'Crawl architecture, Core Web Vitals, structured data and indexation control, fixed where the problem actually lives: in the code.',
    'Arquitetura de rastreamento, Core Web Vitals, dados estruturados e controle de indexação, corrigidos onde o problema realmente está: no código.',
  ),
  optionsLabel: SHARED.optionsLabel,
  optionsHeading: L('Choose how we start.', 'Escolha como começar.'),
  optionsLead: L(
    'Start with a technical diagnosis, a content subscription, or backlink work. Confirm the deliverables and implementation responsibilities for the option you choose.',
    'Comece com um diagnóstico técnico, uma assinatura de conteúdo ou trabalho de backlinks. Confirme as entregas e as responsabilidades de implementação da opção escolhida.',
  ),
  options: TECHNICAL_SEO_OPTIONS,
  optionsNote: SHARED.optionsNote,
  optionsNoteStrong: SHARED.optionsNoteStrong,
  processLabel: SHARED.processLabel,
  processHeading: SHARED.processHeading,
  steps: TECHNICAL_SEO_STEPS,
  auditCta: L('Start with an audit', 'Comece com um diagnóstico'),
  contactLabel: SHARED.contactLabel,
  contactHeading: L('Stop losing customers to the answer box.', 'Pare de perder clientes para quem aparece primeiro.'),
  contactSub: SHARED.contactSub,
  bookCall: SHARED.bookCall,
  seeOptions: SHARED.seeOptions,
  pricingAnchor: C('#subscribe'),
}

const GEO_ENTRY: CopySource<ServiceContent> = {
  navLabel: C('GEO'),
  navJp: C('生成'),
  kicker: L('Service · GEO', 'Serviço · GEO'),
  promise: L('Get cited by the answer engines', 'Seja citado pelos motores de resposta'),
  hero: [L('Be the', 'Seja a'), L('answer.', 'resposta.')],
  sub: L(
    'Generative Engine Optimization. We structure your content, entities and authority signals so ChatGPT, Perplexity and Google AI Overviews quote you by name when your buyers ask.',
    'Otimização para Motores Generativos (GEO). Estruturamos seu conteúdo, entidades e sinais de autoridade para ChatGPT, Perplexity e AI Overviews do Google citarem você pelo nome quando seus compradores perguntam.',
  ),
  optionsLabel: SHARED.optionsLabel,
  optionsHeading: L('Get into the answer, not under it.', 'Entre na resposta, não fique embaixo dela.'),
  optionsLead: L(
    'Three ways to start. Every option ends with citations you can search for and verify yourself, not a report of recommendations.',
    'Três formas de começar. Toda opção termina com citações que você mesmo consegue buscar e verificar, não um relatório de recomendações.',
  ),
  options: [GEO_AUDIT, GEO_SPRINT, GEO_RETAINER],
  optionsNote: SHARED.optionsNote,
  optionsNoteStrong: SHARED.optionsNoteStrong,
  processLabel: SHARED.processLabel,
  processHeading: SHARED.processHeading,
  steps: GEO_STEPS,
  auditCta: L('Start with the citation audit', 'Comece com a auditoria de citações'),
  contactLabel: SHARED.contactLabel,
  contactHeading: L('Be the name the answer engines quote.', 'Seja o nome que os motores de resposta citam.'),
  contactSub: SHARED.contactSub,
  bookCall: SHARED.bookCall,
  seeOptions: SHARED.seeOptions,
}

const WEB_DEVELOPMENT_ENTRY: CopySource<ServiceContent> = {
  navLabel: L('Web Development', 'Sites e landing pages'),
  navJp: C('開発'),
  kicker: L('Service · Web Development', 'Serviço · Sites e landing pages'),
  promise: L('Sites built to rank from the first commit', 'Sites construídos para ranquear desde o primeiro commit'),
  hero: [L('Built to', 'Construído'), L('rank.', 'para ranquear.')],
  sub: L(
    'Next.js and Astro builds where performance budgets, semantic HTML and structured data are requirements, not afterthoughts. Migrations planned around ranking risk — redirects, QA and monitoring built in.',
    'Construções em Next.js e Astro onde orçamentos de performance, HTML semântico e dados estruturados são requisitos, não reflexões tardias. Migrações planejadas em torno do risco de ranking — redirecionamentos, QA e monitoramento incluídos.',
  ),
  optionsLabel: SHARED.optionsLabel,
  optionsHeading: L('Build it right, rank from day one.', 'Construa certo, ranqueie desde o dia um.'),
  optionsLead: L(
    'Three ways to engage, one standard of work. Every build ships with performance budgets, semantic HTML and structured data included.',
    'Três formas de engajar, um padrão de trabalho. Toda construção entrega orçamentos de performance, HTML semântico e dados estruturados incluídos.',
  ),
  options: [WEB_AUDIT, WEB_SPRINT, WEB_RETAINER],
  optionsNote: SHARED.optionsNote,
  optionsNoteStrong: SHARED.optionsNoteStrong,
  processLabel: SHARED.processLabel,
  processHeading: SHARED.processHeading,
  steps: WEB_STEPS,
  auditCta: L('Start with the build audit', 'Comece com a auditoria de build'),
  contactLabel: SHARED.contactLabel,
  contactHeading: L('Sites that rank from the first commit.', 'Sites que ranqueiam desde o primeiro commit.'),
  contactSub: SHARED.contactSub,
  bookCall: SHARED.bookCall,
  seeOptions: SHARED.seeOptions,
  pricingAnchor: C('#builds'),
}

const PAID_SEARCH_ENTRY: CopySource<ServiceContent> = {
  navLabel: L('Paid Search', 'Google Ads'),
  navJp: C('広告'),
  kicker: L('Service · Paid Search', 'Serviço · Google Ads'),
  promise: L('Buy the clicks you cannot win yet', 'Compre os cliques que você ainda não consegue ganhar'),
  hero: [L('Own the', 'Seja dono'), L('clicks.', 'dos cliques.')],
  sub: L(
    'Google Ads managed against the same keyword map as your organic strategy. One plan, two channels, no wasted spend while the organic work compounds.',
    'Google Ads gerenciado contra o mesmo mapa de palavras-chave da sua estratégia orgânica. Um plano, dois canais, sem gasto desperdiçado enquanto o trabalho orgânico compõe.',
  ),
  optionsLabel: SHARED.optionsLabel,
  optionsHeading: L('Spend that compounds, not burns.', 'Gasto que compõe, não queima.'),
  optionsLead: L(
    'Three ways to start. Every option runs on the same keyword map as your organic strategy, so the channels reinforce each other.',
    'Três formas de começar. Toda opção roda no mesmo mapa de palavras-chave da sua estratégia orgânica, para os canais se reforçarem.',
  ),
  options: [ADS_AUDIT, ADS_SPRINT, ADS_RETAINER],
  optionsNote: SHARED.optionsNote,
  optionsNoteStrong: SHARED.optionsNoteStrong,
  processLabel: SHARED.processLabel,
  processHeading: SHARED.processHeading,
  steps: ADS_STEPS,
  auditCta: L('Start with the account audit', 'Comece com a auditoria de conta'),
  contactLabel: SHARED.contactLabel,
  contactHeading: L('Turn spend into rankings you own.', 'Transforme gasto em rankings que são seus.'),
  contactSub: SHARED.contactSub,
  bookCall: SHARED.bookCall,
  seeOptions: SHARED.seeOptions,
  pricingAnchor: C('#subscribe'),
}

const META_ADS_ENTRY: CopySource<ServiceContent> = {
  navLabel: C('Meta Ads'),
  navJp: C('広告'),
  kicker: L('Service · Meta Ads', 'Serviço · Meta Ads'),
  promise: L('Buy the attention you cannot win yet', 'Compre a atenção que você ainda não consegue ganhar'),
  hero: [L('Reach', 'Alcance'), L('that converts.', 'que converte.')],
  sub: L(
    'Facebook and Instagram campaigns managed against the same keyword and conversion data as your organic strategy. Audiences, creative and budget in one plan, no wasted spend.',
    'Campanhas no Facebook e Instagram gerenciadas contra os mesmos dados de palavras-chave e conversão da sua estratégia orgânica. Públicos, criativos e orçamento em um plano, sem desperdício.',
  ),
  optionsLabel: SHARED.optionsLabel,
  optionsHeading: L('Spend where the eyes are.', 'Gaste onde estão os olhos.'),
  optionsLead: L(
    'Three ways to start. Every option runs on the same conversion and audience data as the rest of your strategy, so the channels reinforce each other.',
    'Três formas de começar. Toda opção roda nos mesmos dados de conversão e público do restante da sua estratégia, para os canais se reforçarem.',
  ),
  options: [META_AUDIT, META_SPRINT, META_RETAINER],
  optionsNote: SHARED.optionsNote,
  optionsNoteStrong: SHARED.optionsNoteStrong,
  processLabel: SHARED.processLabel,
  processHeading: SHARED.processHeading,
  steps: META_STEPS,
  auditCta: L('Start with the Meta audit', 'Comece com a auditoria Meta'),
  contactLabel: SHARED.contactLabel,
  contactHeading: L('Turn scroll into revenue.', 'Transforme o scroll em receita.'),
  contactSub: SHARED.contactSub,
  bookCall: SHARED.bookCall,
  seeOptions: SHARED.seeOptions,
  pricingAnchor: C('#subscribe'),
}

const AI_AUTOMATION_ENTRY: CopySource<ServiceContent> = {
  navLabel: L('AI Automation', 'Automação com IA'),
  navJp: C('自動'),
  kicker: L('Service · AI Automation', 'Serviço · Automação com IA'),
  promise: L('Make the busywork run itself', 'Deixe o trabalho repetitivo rodar sozinho'),
  hero: [L('Automate the', 'Automatize o'), L('repetitive.', 'repetitivo.')],
  sub: L(
    'AI automation and workflow engineering: agents, integrations and internal tools that do the repetitive work, scoped and quoted per project.',
    'Automação com IA e engenharia de fluxos: agentes, integrações e ferramentas internas que eliminam o trabalho repetitivo — escopados e orçados sob consulta.',
  ),
  optionsLabel: L('Scope', 'Escopo'),
  optionsHeading: L('Quoted to your workflow.', 'Orçado para o seu fluxo.'),
  optionsLead: L(
    'Every automation project is scoped to your stack and your team, then quoted — no generic packages, no one-size-fits-all.',
    'Todo projeto de automação é escopado para o seu stack e o seu time, e então orçado — sem pacotes genéricos, sem tamanho único.',
  ),
  options: [
    {
      jp: C('自動'),
      name: L('Custom Automation', 'Automação Sob Medida'),
      priceBRL: null,
      priceLabel: L('Quote only', 'Sob consulta'),
      per: L('Scoped per project', 'Escopado por projeto'),
      desc: L(
        'Agents, integrations and internal tools that remove repetitive work from your operations.',
        'Agentes, integrações e ferramentas internas que removem trabalho repetitivo das suas operações.',
      ),
      items: [
        L('Discovery call and workflow map', 'Chamada de descoberta e mapa de fluxos'),
        L('Scoped proposal with a fixed price', 'Proposta escopada com preço fechado'),
        L('Built in your stack, with your tools', 'Construído no seu stack, com as suas ferramentas'),
        L('Handover with docs and training', 'Entrega com documentação e treinamento'),
        L('Support after launch', 'Suporte após o lançamento'),
      ],
      cta: L('Request a quote', 'Solicitar orçamento'),
      subject: C('AI automation quote request'),
    },
  ],
  optionsNote: L('a straight answer if we are not the right fit.', 'uma resposta direta se não formos a escolha certa.'),
  optionsNoteStrong: L('Every quote:', 'Todo orçamento:'),
  processLabel: SHARED.processLabel,
  processHeading: SHARED.processHeading,
  steps: AI_STEPS,
  auditCta: L('Request a quote', 'Solicitar orçamento'),
  contactLabel: SHARED.contactLabel,
  contactHeading: L('What should run itself?', 'O que deveria rodar sozinho?'),
  contactSub: SHARED.contactSub,
  bookCall: SHARED.bookCall,
  seeOptions: L('See how it works', 'Veja como funciona'),
}

const SERVICE_CONTENT_SOURCE: CopySource<Record<ServiceId, ServiceContent>> = {
  'technical-seo': TECHNICAL_SEO_ENTRY,
  geo: GEO_ENTRY,
  'web-development': WEB_DEVELOPMENT_ENTRY,
  'paid-search': PAID_SEARCH_ENTRY,
  'meta-ads': META_ADS_ENTRY,
  'ai-automation': AI_AUTOMATION_ENTRY,
}

export const SERVICE_CONTENT: Record<Locale, Record<ServiceId, ServiceContent>> = {
  'en-US': resolveCopy<Record<ServiceId, ServiceContent>>(SERVICE_CONTENT_SOURCE, 'en-US'),
  'pt-BR': resolveCopy<Record<ServiceId, ServiceContent>>(SERVICE_CONTENT_SOURCE, 'pt-BR'),
}

export function serviceForPath(pathname: string): ServiceId | undefined {
  // Only the two real namespaces resolve: /services/<slug> (en-US) and
  // /pt-br/servicos/<slug> (pt-BR). Mixed forms like /pt-br/services/x or
  // /servicos/x must not resolve to a service.
  const match = /^\/(?:pt-br\/servicos|services)\/([a-z-]+)$/.exec(normalizePath(pathname))
  if (!match) return undefined
  return resolveServiceSlug(match[1])
}

/**
 * Validates a [slug] route param against the known page slugs. Kept
 * isomorphic (no @sveltejs/kit imports) so the edge bundle can keep importing
 * this module — the [slug] loaders call it and raise 404 themselves.
 */
export function resolveServiceSlug(slug: string): ServiceId | undefined {
  return (SERVICE_IDS as readonly string[]).includes(slug) ? (slug as ServiceId) : undefined
}

export function serviceNavigation(locale: Locale) {
  return SERVICE_IDS.map((id) => ({
    id,
    to: SERVICE_ROUTES[id][locale],
    label: SERVICE_CONTENT[locale][id].navLabel,
    jp: SERVICE_CONTENT[locale][id].navJp,
  }))
}
