import type { Locale } from './locale'
import { C, L, resolveCopy, type CopySource } from './localized-copy'
import { TECHNICAL_SEO_STEPS } from './services'

/**
 * Browser-side bound for the `/api/checkout/subscription` round-trip.
 *
 * Deliberately LONGER than the server's `REQUEST_TIMEOUT_MS` (15s in
 * `src/lib/server/mercadoPago.ts`): this timer starts when the browser issues
 * the fetch, so it also covers browser→function latency and server
 * processing. An equal or shorter client timeout could abort right as the
 * server returns the checkout URL, turning a successful preapproval into a
 * generic failure. Guarded by `checkout-timeouts.unit.test.ts`.
 */
export const CHECKOUT_REQUEST_TIMEOUT_MS = 30_000

/**
 * Browser-side bound for the `/api/contact/submit` round-trip.
 *
 * Deliberately LONGER than the server's MailJet request timeout
 * (`MAILJET_REQUEST_TIMEOUT_MS`, 15s in `src/lib/server/mailjet.ts`), for the
 * same reason as the checkout timer above: the browser clock starts when the
 * fetch is issued, so an equal or shorter client timeout could abort right as
 * the server returns success. Guarded by `contact-timeouts.unit.test.ts`.
 */
export const CONTACT_REQUEST_TIMEOUT_MS = 30_000

// The site's public inboxes. Contact and quote CTAs no longer link to these
// directly — they funnel into the opt-in contact form page — but the
// addresses remain the visible fallback on the contact page and the MailJet
// sender/owner-inbox defaults (see src/lib/server/mailjet.ts and contact.ts).
export const EMAIL = 'contact@AdvancedDigitalMarketingLTDA.com'
export const PORTUGUESE_EMAIL = 'contato@AdvancedDigitalMarketingLTDA.com'

export const LINKS = [
  { to: '/', label: 'Home', jp: 'ホーム' },
  { to: '/about', label: 'About', jp: '概要' },
  { to: '/contact', label: 'Contact', jp: '連絡' },
]

export const JP = {
  brand: '先進デジタルマーケティング',
  heroRail: 'アドバンスト・デジタル・マーケティング / 答',
  seal: '答',
  platforms: '基盤',
  services: '業務',
  audit: '監査',
  build: '構築',
  compound: '複利',
  operator: '運営者',
  contact: '連絡',
  office: '所在地',
  navigate: '案内',
  goal: '目的',
  site: 'サイト',
  deadline: '期限',
} as const

/* ─── Page copy (centralized per repo guidelines) ─────────────────────── */

export type HomeService = { jp: string; title: string; line: string; detail: string; tags: string[]; product: string }
export type HomeStep = { jp: string; title: string; text: string }
export type HomeReason = { mark: string; title: string; text: string }

export type HomeCopy = {
  kicker: string
  searchChanging: string
  hero: [string, string, string]
  heroSub: string
  book: string
  email: string
  whatsapp: string
  emailCta: string
  explore: string
  detailsSuffix: string
  servicesLabel: string
  servicesHeading: string
  serviceCta: string
  services: HomeService[]
  processLabel: string
  processHeading: string
  steps: HomeStep[]
  audit: string
  whyLabel: string
  whyHeading: string
  whyLead: string
  whyLeadStrong: string
  whyLeadAfter: string
  cityAlt: string
  reasons: HomeReason[]
  peopleLabel: string
  peopleHeading: string
  portraitAlt: string
  quote: string
  role: string
  bio: string[]
  write: string
  contactLabel: string
  contactHeading: string
  contactSub: string
}

export type AboutCopy = {
  operator: string
  hero: string
  portraitAlt: string
  background: string
  heading: string
  story: string[]
  capabilities: string
  capabilitiesHeading: string
  capabilityGroups: string[][]
  facts: [string, string][]
  contactHeading: string
  bookCall: string
  whatsapp: string
}

export type ContactCopy = {
  label: string
  hero: string
  heroAccent: string
  intro: string
  office: string
  status: string
  notesLabel: string
  notesHeading: string
  notes: [string, string, string][]
  formCta: string
  formLabel: string
  formHeading: string
  formLead: string
  nameLabel: string
  namePlaceholder: string
  emailLabel: string
  emailPlaceholder: string
  consentLabel: string
  submit: string
  submitting: string
  noscript: string
  successTitle: string
  successLead: string
  sentLead: string
  invalidName: string
  invalidEmail: string
  consentRequired: string
  genericError: string
  serverMisconfigured: string
  rateLimited: string
}

export type PageCopy = {
  home: HomeCopy
  about: AboutCopy
  contact: ContactCopy
}

/* ─── Page copy (centralized per repo guidelines) ─────────────────────── */
//
// Copy is declared ONCE per leaf with L(en, pt) / C(shared) from
// localized-copy.ts and resolved into the plain Record<Locale, PageCopy>
// below — two parallel locale literals are what the SonarCloud duplication
// gate flagged (7.9% > 3%).

const SEO_SERVICES_CARD: CopySource<HomeService> = {
  jp: C('技術'),
  title: L('Technical SEO', 'SEO técnico e local'),
  line: L('The foundation everything else sits on.', 'Faça sua empresa aparecer nas buscas certas.'),
  detail: L(
    'Crawl architecture, Core Web Vitals, structured data and indexation control. We find what is holding your site back and fix it at the code level, where the problem actually lives.',
    'Google Perfil da Empresa, páginas de serviço e cidade, dados estruturados, Core Web Vitals, indexação e intenção local.',
  ),
  tags: [L('Site audit', 'Perfil da Empresa'), L('Schema markup', 'Páginas locais'), L('Speed engineering', 'Dados estruturados'), L('Log analysis', 'Indexação')],
  product: C('seo'),
}

const GEO_SERVICES_CARD: CopySource<HomeService> = {
  jp: C('生成'),
  title: L('GEO', 'GEO / visibilidade em respostas de IA'),
  line: L('Get cited by the answer engines.', 'Seja lembrado quando alguém perguntar.'),
  detail: L(
    'Generative Engine Optimization. We structure your content, entities and authority signals so ChatGPT, Perplexity and Google AI Overviews quote you by name when your buyers ask.',
    'Conteúdo, entidades, autoridade e FAQs estruturadas para ChatGPT, Perplexity e AI Overviews do Google — visibilidade em respostas de IA, não só nos resultados tradicionais.',
  ),
  tags: [L('Entity mapping', 'Entidades'), L('Answer-first content', 'Conteúdo para respostas'), L('Citation tracking', 'FAQs estruturadas'), L('llms.txt', 'Citações')],
  product: C('seo'),
}

const WEB_DEVELOPMENT_SERVICES_CARD: CopySource<HomeService> = {
  jp: C('開発'),
  title: L('Web Development', 'Sites e landing pages'),
  line: L('Sites built to rank from the first commit.', 'Caminhos claros para WhatsApp e orçamento.'),
  detail: L(
    'Next.js and Astro builds where performance budgets, semantic HTML and structured data are requirements, not afterthoughts. Migrations planned around ranking risk — redirects, QA and monitoring built in.',
    'Páginas rápidas, mobile-first e com mensagem clara, construídas para transformar busca em conversa e pedido de orçamento.',
  ),
  tags: [L('Design and build', 'Mobile-first'), L('Headless CMS', 'Landing pages'), L('Safe migrations', 'Performance'), L('CRO iteration', 'Conversão')],
  product: C('website-development'),
}

const PAID_SEARCH_SERVICES_CARD: CopySource<HomeService> = {
  jp: C('広告'),
  title: L('Paid Search', 'Google Ads'),
  line: L('Buy the clicks you cannot win yet.', 'Acelere a demanda que ainda não é orgânica.'),
  detail: L(
    'Google Ads managed against the same keyword map as your organic strategy. One plan, two channels, no wasted spend while the organic work compounds.',
    'Google Ads alinhados à busca orgânica, à intenção local, às conversões e ao custo por oportunidade.',
  ),
  tags: [L('Account restructure', 'Google Ads'), L('Landing pages', 'Intenção local'), L('Feed optimization', 'Conversões'), L('Weekly reporting', 'Custo por oportunidade')],
  product: C('google-ads-management'),
}

const META_ADS_SERVICES_CARD: CopySource<HomeService> = {
  jp: C('広告'),
  title: C('Meta Ads'),
  line: L('Buy attention while the organic work compounds.', 'Compre atenção enquanto o orgânico compõe.'),
  detail: L(
    'Facebook and Instagram campaigns run against the same keyword and conversion data as your organic strategy. One plan, every channel, no wasted spend.',
    'Campanhas no Facebook e Instagram alinhadas aos mesmos dados de palavras-chave e conversão da sua estratégia orgânica. Um plano, todos os canais, sem desperdício.',
  ),
  tags: [L('Audience targeting', 'Segmentação de públicos'), L('Creative testing', 'Testes de criativos'), L('Pixel and tracking', 'Pixel e rastreamento'), L('Weekly reporting', 'Relatórios semanais')],
  product: C('meta-ads-management'),
}

const PAGE_COPY_SOURCE: CopySource<PageCopy> = {
  home: {
    kicker: L('We design the answer.', 'SEO local · GEO · Sites que convertem'),
    searchChanging: L('Search is changing', 'A busca está mudando'),
    hero: [L('We make sure', 'Sua empresa precisa ser'), L('you get', 'encontrada onde a decisão'), L('found.', 'acontece.')],
    heroSub: L(
      'A São Paulo engineering studio putting US small businesses on top of Google and inside AI answers.',
      'Ajudamos empresas locais brasileiras a aparecer nas buscas certas, receber mais contatos e transformar tráfego em oportunidades — com engenharia, não relatórios genéricos.',
    ),
    book: L('Book a strategy call', 'Falar pelo WhatsApp'),
    email: L('Book a strategy call', 'Agendar uma conversa por e-mail'),
    whatsapp: L('Book via WhatsApp', 'Falar pelo WhatsApp'),
    emailCta: L(EMAIL, PORTUGUESE_EMAIL),
    explore: L('Explore services', 'Conheça os serviços'),
    detailsSuffix: L('details', 'detalhes'),
    servicesLabel: L('Services', 'Serviços'),
    servicesHeading: L('What we do', 'O que fazemos'),
    serviceCta: L('Start with this service', 'Começar com este serviço'),
    services: [SEO_SERVICES_CARD, GEO_SERVICES_CARD, WEB_DEVELOPMENT_SERVICES_CARD, PAID_SEARCH_SERVICES_CARD, META_ADS_SERVICES_CARD],
    processLabel: L('Process', 'Processo'),
    processHeading: L('How it runs', 'Como o trabalho acontece'),
    // The homepage walks through the same 4-step engagement as the service
    // pages — reuse the single declaration instead of repeating the copy.
    steps: TECHNICAL_SEO_STEPS,
    audit: L('Start with an audit', 'Comece com um diagnóstico'),
    whyLabel: L('Why us', 'Por que nós'),
    whyHeading: L('Built by engineers, priced by São Paulo.', 'Engenharia de busca para empresas brasileiras.'),
    whyLead: L('Most agencies sell you a retainer and staff it with whoever is free.', 'Você não precisa de mais um relatório genérico.'),
    whyLeadStrong: L('We are an owner-operated engineering studio by design.', 'Somos um estúdio de engenharia operado pelo próprio fundador.'),
    whyLeadAfter: L(
      ' The audit, the code, the content system and the ad account are all run by the people you actually talk to.',
      ' Da auditoria à implementação, busca, site e mídia são conduzidos pelas pessoas com quem você realmente fala.',
    ),
    cityAlt: L('São Paulo skyline rendered in ink and vermilion', 'Horizonte de São Paulo em tinta e vermelhão'),
    reasons: [
      {
        mark: C('壱'),
        title: L('Senior only', 'Equipe sênior, sem repasses'),
        text: L(
          'The person who audits your site is the person who writes the code. No handoffs, no account manager translating between you and the work.',
          'Quem audita seu site é quem escreve o código. Você fala direto com quem executa o trabalho.',
        ),
      },
      {
        mark: C('弐'),
        title: L('AI search first', 'Conhecimento do mercado brasileiro com engenharia de verdade'),
        text: L(
          'Most agencies bolt GEO onto an SEO retainer. We build for answer engines from day one, because that is where your buyers are going.',
          'Busca local, dados estruturados e implementação técnica para transformar intenção em contatos.',
        ),
      },
      {
        mark: C('参'),
        title: L('US market, Brazil cost', 'Busca, site e mídia trabalhando para o mesmo contato'),
        text: L(
          'A team that works your hours and knows the US market, at São Paulo rates. Better work, lower burn, no timezone gymnastics.',
          'Google, site, WhatsApp e anúncios partem do mesmo mapa de intenção e conversão.',
        ),
      },
      {
        mark: C('終'),
        title: L('Everything in writing', 'Os ativos continuam sendo seus'),
        text: L(
          'Scope, timelines, projected impact and the assumptions behind them. If we cannot put a number on it, we say so.',
          'Código, conteúdo, contas e dados permanecem seus. Tudo fica documentado e sob seu controle.',
        ),
      },
    ],
    peopleLabel: L('People', 'Pessoas'),
    peopleHeading: L('Who you work with', 'Com quem você trabalha'),
    portraitAlt: L('Andrew Weilbacher, founder of Advanced Digital Marketing', 'Andrew Weilbacher, fundador da Advanced Digital Marketing'),
    quote: C('「検索の未来を、設計する。」'),
    role: L('Founder · Lead Engineer', 'Fundador · Engenheiro-chefe'),
    bio: [
      L(
        'Andrew runs every engagement end to end: the audit, the architecture, the build and the reporting. Before founding Advanced Digital Marketing, he led engineering and growth work for US e-commerce and B2B service companies.',
        'Andrew conduz cada projeto do início ao fim a partir de São Paulo: auditoria, arquitetura, implementação e medição. Você fala diretamente com o fundador e engenheiro que executa o trabalho.',
      ),
      L(
        'He started the studio in São Paulo for one reason: senior engineering for search should not cost what US agencies charge.',
        'A Advanced Digital Marketing LTDA é uma empresa brasileira registrada no CNPJ, com operação direta para negócios que precisam gerar contatos nas buscas locais e nas respostas de IA.',
      ),
    ],
    write: L('Write to Andrew', 'Escreva para Andrew'),
    contactLabel: L('Contact', 'Contato'),
    contactHeading: L('Stop losing customers to the answer box.', 'Pare de perder clientes para quem aparece primeiro.'),
    contactSub: L(
      'One email starts it. We reply within one business day with next steps and a straight answer on whether we can help.',
      'Conte o que você vende, onde atende e o que precisa melhorar. A primeira resposta vem diretamente de quem vai analisar o trabalho.',
    ),
  },
  about: {
    operator: L('The operator', 'O operador'),
    hero: L(
      'Founder and operator of Advanced Digital Marketing LTDA. SEO engineer, web developer, and paid media practitioner.',
      'Fundador e operador da Advanced Digital Marketing LTDA. Engenheiro de SEO técnico e local, desenvolvedor web, especialista em GEO e mídia paga.',
    ),
    portraitAlt: L('Portrait of Andrew Philip Weilbacher', 'Retrato de Andrew Philip Weilbacher'),
    background: L('Background', 'Trajetória'),
    heading: L('One person, full stack, two markets.', 'Uma operação brasileira, da estratégia ao código.'),
    story: [
      L(
        'Andrew was born in the United States, built his early career between Pennsylvania and Florida, and now runs his agency from São Paulo, Brazil. Advanced Digital Marketing LTDA is a CNPJ-registered Brazilian company serving clients on both sides of the border.',
        'Andrew é fundador e engenheiro-chefe da Advanced Digital Marketing LTDA, empresa brasileira registrada no CNPJ e operada a partir de São Paulo.',
      ),
      L(
        'His background is technical: search infrastructure, machine-learning-assisted ranking research, and agent-assisted web development. Strategy, implementation, and measurement come from the same desk.',
        'Sua atuação combina SEO técnico e local, sites, GEO e aquisição paga — com estratégia, implementação e medição na mesma mesa.',
      ),
      L(
        "The agency's edge is GEO: optimizing not only for Google's classic results, but for the AI answer engines that increasingly decide which businesses get mentioned at all.",
        'Você fala diretamente com quem analisa e executa o trabalho. Sem repasse para gerente de contas e sem separar busca, site e mídia em planos desconectados.',
      ),
    ],
    capabilities: L('Capabilities', 'Capacidades'),
    capabilitiesHeading: L('The work stays connected.', 'O trabalho permanece conectado.'),
    capabilityGroups: [
      [
        L('Search', 'Busca'),
        L('Technical SEO', 'SEO técnico e local'),
        L('GEO and AI answer optimization', 'Visibilidade em respostas de IA (GEO)'),
        L('Topical authority mapping', 'Google Perfil da Empresa'),
        L('Structured data', 'Dados estruturados e páginas de serviço'),
      ],
      [L('Media', 'Mídia'), C('Google Ads'), L('Meta and LinkedIn', 'Meta'), L('Creative testing systems', 'Aquisição alinhada a conversões')],
      [
        L('Build', 'Desenvolvimento'),
        L('Web design and development', 'Sites e landing pages'),
        L('Modern headless stacks', 'Performance mobile-first'),
        C('Core Web Vitals'),
        L('Analytics and measurement', 'Analytics e medição'),
      ],
    ],
    facts: [
      [C('Base'), C('São Paulo, BR')],
      [L('Markets', 'Mercado'), L('US + Brazil', 'Empresas brasileiras')],
      [L('Structure', 'Estrutura'), L('Owner-operated', 'Operação direta')],
      [L('Entity', 'Empresa'), L('LTDA, CNPJ-registered', 'LTDA, registrada no CNPJ')],
    ],
    contactHeading: L('Work with the person who does the work.', 'Trabalhe com quem executa o trabalho.'),
    bookCall: L('Book a strategy call', 'Agende uma conversa'),
    whatsapp: L('Book via WhatsApp', 'Falar pelo WhatsApp'),
  },
  contact: {
    label: L('Contact', 'Contato'),
    hero: L('Open a', 'Abra um'),
    heroAccent: L('channel.', 'canal.'),
    intro: L(
      'Send your name and email, confirm your opt-in, and verify your address — the first reply comes straight from the person doing the work.',
      'Envie seu nome e e-mail, confirme seu consentimento e verifique seu endereço — a primeira resposta vem diretamente de quem vai analisar o trabalho.',
    ),
    office: L('Registered office', 'Sede registrada'),
    status: L('Channel: open', 'Canal: aberto'),
    notesLabel: L('What happens next', 'O que acontece agora'),
    notesHeading: L('Three steps, one inbox.', 'Três passos, uma caixa de entrada.'),
    notes: [
      [L('Submit', 'Enviar'), C('送信'), L('Your name and email, plus your explicit consent to be contacted.', 'Seu nome e e-mail, com seu consentimento explícito para ser contatado(a).')],
      [
        L('Verify', 'Verificar'),
        C('確認'),
        L(
          'We email you a confirmation link. Click it — this proves the address is yours and confirms the opt-in.',
          'Enviamos um link de confirmação por e-mail. Clique nele — isso prova que o endereço é seu e confirma o opt-in.',
        ),
      ],
      [
        L('Reply', 'Responder'),
        C('返信'),
        L('The verified request lands with the owner, who replies within one business day.', 'A solicitação verificada chega ao responsável, que responde em até um dia útil.'),
      ],
    ],
    formCta: L('Start the contact form', 'Abrir formulário de contato'),
    formLabel: L('Contact form', 'Formulário de contato'),
    formHeading: L('Send a message.', 'Envie uma mensagem.'),
    formLead: L(
      'Leave your name and email below. We confirm your opt-in by email, then reply within one business day.',
      'Deixe seu nome e e-mail abaixo. Confirmamos seu consentimento por e-mail e respondemos em até um dia útil.',
    ),
    nameLabel: L('Name', 'Nome'),
    namePlaceholder: L('Your name', 'Seu nome'),
    emailLabel: L('Email', 'E-mail'),
    emailPlaceholder: L('you@company.com', 'voce@empresa.com.br'),
    consentLabel: L(
      'I agree that Advanced Digital Marketing LTDA may use the details I provide to reply to my enquiry, and I consent to being contacted by email. I understand I can withdraw my consent at any time.',
      'Concordo que a Advanced Digital Marketing LTDA utilize os dados informados para responder à minha solicitação e consinto em ser contatado(a) por e-mail. Entendo que posso revogar meu consentimento a qualquer momento.',
    ),
    submit: L('Send request', 'Enviar solicitação'),
    submitting: L('Sending…', 'Enviando…'),
    noscript: L(
      'JavaScript is off: the form still works — submitting sends your request directly and you will see the server response on this page.',
      'JavaScript está desativado: o formulário continua funcionando — o envio é feito diretamente e a resposta do servidor aparece nesta página.',
    ),
    successTitle: L('Check your inbox.', 'Verifique sua caixa de entrada.'),
    successLead: L(
      'We sent a confirmation link to {email}. Click it to verify your address and complete your request. The link expires in {hours} hours.',
      'Enviamos um link de confirmação para {email}. Clique nele para verificar seu endereço e concluir sua solicitação. O link expira em {hours} horas.',
    ),
    sentLead: L(
      'We sent a confirmation link to the address you submitted. Click it to verify your address and complete your request — the link expires in 72 hours.',
      'Enviamos um link de confirmação para o endereço informado. Clique nele para verificar seu endereço e concluir sua solicitação — o link expira em 72 horas.',
    ),
    invalidName: L('Enter your name (max 100 characters).', 'Informe seu nome (máximo de 100 caracteres).'),
    invalidEmail: L('Enter a valid email address.', 'Informe um e-mail válido.'),
    consentRequired: L('Please tick the box to confirm you agree to be contacted.', 'Marque a caixa para confirmar que você concorda em ser contatado(a).'),
    genericError: L('Could not send your request. Please try again.', 'Não foi possível enviar sua solicitação. Tente novamente.'),
    serverMisconfigured: L('The contact form is not configured yet. Please try again later.', 'O formulário de contato ainda não está configurado. Tente novamente mais tarde.'),
    rateLimited: L('Too many attempts. Please try again in a few minutes.', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'),
  },
}

export const PAGE_COPY: Record<Locale, PageCopy> = {
  'en-US': resolveCopy<PageCopy>(PAGE_COPY_SOURCE, 'en-US'),
  'pt-BR': resolveCopy<PageCopy>(PAGE_COPY_SOURCE, 'pt-BR'),
}
