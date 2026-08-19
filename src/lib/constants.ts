import type { Locale } from './locale'

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

export const PAGE_COPY: Record<Locale, PageCopy> = {
  'en-US': {
    home: {
      kicker: 'We design the answer.', searchChanging: 'Search is changing',
      hero: ['We make sure', 'you get', 'found.'],
      heroSub: 'A São Paulo engineering studio putting US small businesses on top of Google and inside AI answers.',
      book: 'Book a strategy call', email: 'Book a strategy call', whatsapp: 'Book via WhatsApp', emailCta: EMAIL, explore: 'Explore services', detailsSuffix: 'details', servicesLabel: 'Services', servicesHeading: 'What we do', serviceCta: 'Start with this service',
      services: [
        { jp: '技術', title: 'Technical SEO', line: 'The foundation everything else sits on.', detail: 'Crawl architecture, Core Web Vitals, structured data and indexation control. We find what is holding your site back and fix it at the code level, where the problem actually lives.', tags: ['Site audit', 'Schema markup', 'Speed engineering', 'Log analysis'], product: 'seo' },
        { jp: '生成', title: 'GEO', line: 'Get cited by the answer engines.', detail: 'Generative Engine Optimization. We structure your content, entities and authority signals so ChatGPT, Perplexity and Google AI Overviews quote you by name when your buyers ask.', tags: ['Entity mapping', 'Answer-first content', 'Citation tracking', 'llms.txt'], product: 'seo' },
        { jp: '開発', title: 'Web Development', line: 'Sites built to rank from the first commit.', detail: 'Next.js and Astro builds where performance budgets, semantic HTML and structured data are requirements, not afterthoughts. Migrations planned around ranking risk — redirects, QA and monitoring built in.', tags: ['Design and build', 'Headless CMS', 'Safe migrations', 'CRO iteration'], product: 'website-development' },
        { jp: '広告', title: 'Paid Search', line: 'Buy the clicks you cannot win yet.', detail: 'Google Ads managed against the same keyword map as your organic strategy. One plan, two channels, no wasted spend while the organic work compounds.', tags: ['Account restructure', 'Landing pages', 'Feed optimization', 'Weekly reporting'], product: 'google-ads-management' },
        { jp: '広告', title: 'Meta Ads', line: 'Buy attention while the organic work compounds.', detail: 'Facebook and Instagram campaigns run against the same keyword and conversion data as your organic strategy. One plan, every channel, no wasted spend.', tags: ['Audience targeting', 'Creative testing', 'Pixel and tracking', 'Weekly reporting'], product: 'meta-ads-management' },
      ],
      processLabel: 'Process', processHeading: 'How it runs',
      steps: [
        { jp: '監査', title: 'Audit', text: 'Two weeks inside your data. We map every query you should own and everything blocking it.' },
        { jp: '設計', title: 'Architecture', text: 'A 90-day plan with named owners, projected impact and the order of operations. You approve it before we touch anything.' },
        { jp: '実装', title: 'Build', text: 'We ship. Code, content and campaigns in weekly releases you can verify yourself, not in a monthly PDF.' },
        { jp: '計測', title: 'Measure', text: 'Rankings, AI citations and revenue, reported monthly in plain English with the next quarter already planned.' },
      ],
      audit: 'Start with an audit', whyLabel: 'Why us', whyHeading: 'Built by engineers, priced by São Paulo.',
      whyLead: 'Most agencies sell you a retainer and staff it with whoever is free.',
      whyLeadStrong: 'We are an owner-operated engineering studio by design.',
      whyLeadAfter: ' The audit, the code, the content system and the ad account are all run by the people you actually talk to.',
      cityAlt: 'São Paulo skyline rendered in ink and vermilion',
      reasons: [
        { mark: '壱', title: 'Senior only', text: 'The person who audits your site is the person who writes the code. No handoffs, no account manager translating between you and the work.' },
        { mark: '弐', title: 'AI search first', text: 'Most agencies bolt GEO onto an SEO retainer. We build for answer engines from day one, because that is where your buyers are going.' },
        { mark: '参', title: 'US market, Brazil cost', text: 'A team that works your hours and knows the US market, at São Paulo rates. Better work, lower burn, no timezone gymnastics.' },
        { mark: '終', title: 'Everything in writing', text: 'Scope, timelines, projected impact and the assumptions behind them. If we cannot put a number on it, we say so.' },
      ],
      peopleLabel: 'People', peopleHeading: 'Who you work with',
      portraitAlt: 'Andrew Weilbacher, founder of Advanced Digital Marketing', quote: '「検索の未来を、設計する。」', role: 'Founder · Lead Engineer',
      bio: ['Andrew runs every engagement end to end: the audit, the architecture, the build and the reporting. Before founding Advanced Digital Marketing, he led engineering and growth work for US e-commerce and B2B service companies.', 'He started the studio in São Paulo for one reason: senior engineering for search should not cost what US agencies charge.'],
      write: 'Write to Andrew', contactLabel: 'Contact', contactHeading: 'Stop losing customers to the answer box.',
      contactSub: 'One email starts it. We reply within one business day with next steps and a straight answer on whether we can help.',
    },
    about: {
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
    },
    contact: {
      label: 'Contact', hero: 'Open a', heroAccent: 'channel.',
      intro: 'Send your name and email, confirm your opt-in, and verify your address — the first reply comes straight from the person doing the work.',
      office: 'Registered office', status: 'Channel: open',
      notesLabel: 'What happens next', notesHeading: 'Three steps, one inbox.',
      notes: [
        ['Submit', '送信', 'Your name and email, plus your explicit consent to be contacted.'],
        ['Verify', '確認', 'We email you a confirmation link. Click it — this proves the address is yours and confirms the opt-in.'],
        ['Reply', '返信', 'The verified request lands with the owner, who replies within one business day.'],
      ],
      formLabel: 'Contact form',
      formHeading: 'Send a message.',
      formLead: 'Leave your name and email below. We confirm your opt-in by email, then reply within one business day.',
      nameLabel: 'Name', namePlaceholder: 'Your name',
      emailLabel: 'Email', emailPlaceholder: 'you@company.com',
      consentLabel: 'I agree that Advanced Digital Marketing LTDA may use the details I provide to reply to my enquiry, and I consent to being contacted by email. I understand I can withdraw my consent at any time.',
      submit: 'Send request', submitting: 'Sending…',
      noscript: 'JavaScript is off: the form still works — submitting sends your request directly and you will see the server response on this page.',
      successTitle: 'Check your inbox.',
      successLead: 'We sent a confirmation link to {email}. Click it to verify your address and complete your request. The link expires in {hours} hours.',
      invalidName: 'Enter your name (max 100 characters).',
      invalidEmail: 'Enter a valid email address.',
      consentRequired: 'Please tick the box to confirm you agree to be contacted.',
      genericError: 'Could not send your request. Please try again.',
      serverMisconfigured: 'The contact form is not configured yet. Please try again later.',
      rateLimited: 'Too many attempts. Please try again in a few minutes.',
    },
  },
  'pt-BR': {
    home: {
      kicker: 'SEO local · GEO · Sites que convertem', searchChanging: 'A busca está mudando',
      hero: ['Sua empresa precisa ser', 'encontrada onde a decisão', 'acontece.'],
      heroSub: 'Ajudamos empresas locais brasileiras a aparecer nas buscas certas, receber mais contatos e transformar tráfego em oportunidades — com engenharia, não relatórios genéricos.',
      book: 'Falar pelo WhatsApp', email: 'Agendar uma conversa por e-mail', whatsapp: 'Falar pelo WhatsApp', emailCta: PORTUGUESE_EMAIL, explore: 'Conheça os serviços', detailsSuffix: 'detalhes', servicesLabel: 'Serviços', servicesHeading: 'O que fazemos', serviceCta: 'Começar com este serviço',
      services: [
        { jp: '技術', title: 'SEO técnico e local', line: 'Faça sua empresa aparecer nas buscas certas.', detail: 'Google Perfil da Empresa, páginas de serviço e cidade, dados estruturados, Core Web Vitals, indexação e intenção local.', tags: ['Perfil da Empresa', 'Páginas locais', 'Dados estruturados', 'Indexação'], product: 'seo' },
        { jp: '生成', title: 'GEO / visibilidade em respostas de IA', line: 'Seja lembrado quando alguém perguntar.', detail: 'Conteúdo, entidades, autoridade e FAQs estruturadas para ChatGPT, Perplexity e AI Overviews do Google — visibilidade em respostas de IA, não só nos resultados tradicionais.', tags: ['Entidades', 'Conteúdo para respostas', 'FAQs estruturadas', 'Citações'], product: 'seo' },
        { jp: '開発', title: 'Sites e landing pages', line: 'Caminhos claros para WhatsApp e orçamento.', detail: 'Páginas rápidas, mobile-first e com mensagem clara, construídas para transformar busca em conversa e pedido de orçamento.', tags: ['Mobile-first', 'Landing pages', 'Performance', 'Conversão'], product: 'website-development' },
        { jp: '広告', title: 'Google Ads', line: 'Acelere a demanda que ainda não é orgânica.', detail: 'Google Ads alinhados à busca orgânica, à intenção local, às conversões e ao custo por oportunidade.', tags: ['Google Ads', 'Intenção local', 'Conversões', 'Custo por oportunidade'], product: 'google-ads-management' },
        { jp: '広告', title: 'Meta Ads', line: 'Compre atenção enquanto o orgânico compõe.', detail: 'Campanhas no Facebook e Instagram alinhadas aos mesmos dados de palavras-chave e conversão da sua estratégia orgânica. Um plano, todos os canais, sem desperdício.', tags: ['Segmentação de públicos', 'Testes de criativos', 'Pixel e rastreamento', 'Relatórios semanais'], product: 'meta-ads-management' },
      ],
      processLabel: 'Processo', processHeading: 'Como o trabalho acontece',
      steps: [
        { jp: '監査', title: 'Diagnóstico', text: 'Entendemos sua oferta, cidades, concorrência e os bloqueios técnicos que impedem sua empresa de aparecer.' },
        { jp: '設計', title: 'Plano', text: 'Um plano priorizado com responsáveis, impacto esperado e a ordem de execução. Você aprova antes de mexermos em qualquer coisa.' },
        { jp: '実装', title: 'Implementação', text: 'Código, conteúdo, páginas e campanhas em ciclos semanais que você consegue acompanhar.' },
        { jp: '計測', title: 'Medição', text: 'Visibilidade, contatos e oportunidades acompanhados com clareza, junto das próximas decisões.' },
      ],
      audit: 'Comece com um diagnóstico', whyLabel: 'Por que nós', whyHeading: 'Engenharia de busca para empresas brasileiras.',
      whyLead: 'Você não precisa de mais um relatório genérico.',
      whyLeadStrong: 'Somos um estúdio de engenharia operado pelo próprio fundador.',
      whyLeadAfter: ' Da auditoria à implementação, busca, site e mídia são conduzidos pelas pessoas com quem você realmente fala.',
      cityAlt: 'Horizonte de São Paulo em tinta e vermelhão',
      reasons: [
        { mark: '壱', title: 'Equipe sênior, sem repasses', text: 'Quem audita seu site é quem escreve o código. Você fala direto com quem executa o trabalho.' },
        { mark: '弐', title: 'Conhecimento do mercado brasileiro com engenharia de verdade', text: 'Busca local, dados estruturados e implementação técnica para transformar intenção em contatos.' },
        { mark: '参', title: 'Busca, site e mídia trabalhando para o mesmo contato', text: 'Google, site, WhatsApp e anúncios partem do mesmo mapa de intenção e conversão.' },
        { mark: '終', title: 'Os ativos continuam sendo seus', text: 'Código, conteúdo, contas e dados permanecem seus. Tudo fica documentado e sob seu controle.' },
      ],
      peopleLabel: 'Pessoas', peopleHeading: 'Com quem você trabalha',
      portraitAlt: 'Andrew Weilbacher, fundador da Advanced Digital Marketing', quote: '「検索の未来を、設計する。」', role: 'Fundador · Engenheiro-chefe',
      bio: ['Andrew conduz cada projeto do início ao fim a partir de São Paulo: auditoria, arquitetura, implementação e medição. Você fala diretamente com o fundador e engenheiro que executa o trabalho.', 'A Advanced Digital Marketing LTDA é uma empresa brasileira registrada no CNPJ, com operação direta para negócios que precisam gerar contatos nas buscas locais e nas respostas de IA.'],
      write: 'Escreva para Andrew', contactLabel: 'Contato', contactHeading: 'Pare de perder clientes para quem aparece primeiro.',
      contactSub: 'Conte o que você vende, onde atende e o que precisa melhorar. A primeira resposta vem diretamente de quem vai analisar o trabalho.',
    },
    about: {
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
    },
    contact: {
      label: 'Contato', hero: 'Abra um', heroAccent: 'canal.',
      intro: 'Envie seu nome e e-mail, confirme seu consentimento e verifique seu endereço — a primeira resposta vem diretamente de quem vai analisar o trabalho.',
      office: 'Sede registrada', status: 'Canal: aberto',
      notesLabel: 'O que acontece agora', notesHeading: 'Três passos, uma caixa de entrada.',
      notes: [
        ['Enviar', '送信', 'Seu nome e e-mail, com seu consentimento explícito para ser contatado(a).'],
        ['Verificar', '確認', 'Enviamos um link de confirmação por e-mail. Clique nele — isso prova que o endereço é seu e confirma o opt-in.'],
        ['Responder', '返信', 'A solicitação verificada chega ao responsável, que responde em até um dia útil.'],
      ],
      formLabel: 'Formulário de contato',
      formHeading: 'Envie uma mensagem.',
      formLead: 'Deixe seu nome e e-mail abaixo. Confirmamos seu consentimento por e-mail e respondemos em até um dia útil.',
      nameLabel: 'Nome', namePlaceholder: 'Seu nome',
      emailLabel: 'E-mail', emailPlaceholder: 'voce@empresa.com.br',
      consentLabel: 'Concordo que a Advanced Digital Marketing LTDA utilize os dados informados para responder à minha solicitação e consinto em ser contatado(a) por e-mail. Entendo que posso revogar meu consentimento a qualquer momento.',
      submit: 'Enviar solicitação', submitting: 'Enviando…',
      noscript: 'JavaScript está desativado: o formulário continua funcionando — o envio é feito diretamente e a resposta do servidor aparece nesta página.',
      successTitle: 'Verifique sua caixa de entrada.',
      successLead: 'Enviamos um link de confirmação para {email}. Clique nele para verificar seu endereço e concluir sua solicitação. O link expira em {hours} horas.',
      invalidName: 'Informe seu nome (máximo de 100 caracteres).',
      invalidEmail: 'Informe um e-mail válido.',
      consentRequired: 'Marque a caixa para confirmar que você concorda em ser contatado(a).',
      genericError: 'Não foi possível enviar sua solicitação. Tente novamente.',
      serverMisconfigured: 'O formulário de contato ainda não está configurado. Tente novamente mais tarde.',
      rateLimited: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    },
  },
}
