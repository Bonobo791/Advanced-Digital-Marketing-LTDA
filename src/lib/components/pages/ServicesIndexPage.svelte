<script lang="ts">
  import { getContext, onMount } from 'svelte'
  import { SITE_MOTION, type SiteMotion } from '$lib/client/site-motion'
  import { setupReveals } from '$lib/client/reveal'
  import { SERVICES, formatBRL, getService, type ServiceId as CatalogServiceId } from '$lib/catalog'
  import {
    SERVICE_CONTENT,
    SERVICE_IDS,
    SERVICE_ROUTES,
    SERVICE_SUBSCRIPTIONS,
    type ServiceId,
  } from '$lib/services'
  import type { Locale } from '$lib/locale'
  import SubscribeSection from './SubscribeSection.svelte'

  let { locale }: { locale: Locale } = $props()

  const copy = {
    'en-US': {
      kicker: 'Services',
      heading: 'Every channel, one standard of work.',
      sub: 'Search visibility, paid media, web and AI automation. Subscribe monthly to the mix that fits, or engage per project — monthly subscriptions are billed securely through Mercado Pago.',
      perMonth: 'per month',
      monthly: 'Monthly subscription',
      quoteOnly: 'Quote only',
      perProject: 'Per project',
      adsLine: '10% of ad spend (R$ 500 min)',
      view: 'View service',
    },
    'pt-BR': {
      kicker: 'Serviços',
      heading: 'Todo canal, um padrão de trabalho.',
      sub: 'Visibilidade em busca, mídia paga, web e automação com IA. Assine mensalmente a combinação que faz sentido para você, ou contrate por projeto — assinaturas mensais são cobradas com segurança pelo Mercado Pago.',
      perMonth: 'por mês',
      monthly: 'Assinatura mensal',
      quoteOnly: 'Sob consulta',
      perProject: 'Por projeto',
      adsLine: '10% do investimento (mín. R$ 500)',
      view: 'Ver serviço',
    },
  } as const

  let text = $derived(copy[locale])
  const words = (value: string) => value.trim().split(/\s+/)

  const motion = getContext<SiteMotion>(SITE_MOTION)

  onMount(() => {
    motion.registerHero()
    return setupReveals()
  })

  type SubscriptionDisplay = { name: string; detail: string }

  function subscriptionDisplays(id: ServiceId): SubscriptionDisplay[] {
    return SERVICE_SUBSCRIPTIONS[id].map((sid: CatalogServiceId) => {
      const service = SERVICES[sid]
      const name = service.name[locale]
      if (service.pricing.kind === 'ads-spend') return { name, detail: text.adsLine }
      if (service.pricing.kind === 'fixed') {
        return { name, detail: `${formatBRL(service.pricing.monthlyBRL)}/${text.perMonth}` }
      }
      return { name, detail: text.quoteOnly }
    })
  }

  function packagePrice(id: ServiceId): string | undefined {
    const subs = SERVICE_SUBSCRIPTIONS[id]
    if (subs.length === 0) return undefined
    if (subs.some((sid) => SERVICES[sid].pricing.kind === 'ads-spend')) return text.adsLine
    const total = subs.reduce((sum, sid) => {
      const pricing = SERVICES[sid].pricing
      return pricing.kind === 'fixed' ? sum + pricing.monthlyBRL : sum
    }, 0)
    return `${formatBRL(total)}/${text.perMonth}`
  }

  function isQuoteOnly(id: ServiceId): boolean {
    return getService(id)?.pricing.kind === 'quote'
  }
</script>

<div class="index-home service-page services-index">
  <section class="hero index-hero" class:hero-revealed={motion.state.hero === 'revealed'}>
    <div class="sec-inner hero-inner">
      <div class="hero-kick">
        <span class="jp" data-hero-reveal style="--hero-delay:0ms">「業務」</span>
        <span class="en" data-hero-reveal style="--hero-delay:60ms">{text.kicker}</span>
      </div>
      <p class="hero-line1" data-hero-reveal style="--hero-delay:120ms">Services<b>.</b></p>
      <h1 class="hero-h1">
        <span class="h-mask"><span class="h-line" data-hero-reveal style="--hero-delay:180ms">{text.heading.split(' ')[0]}</span></span>
        <span class="h-mask"><span class="h-line" data-hero-reveal style="--hero-delay:270ms"><em>{text.heading.split(' ').slice(1).join(' ')}</em></span></span>
      </h1>
      <div class="hero-row">
        <p class="hero-sub" data-hero-reveal style="--hero-delay:440ms">{text.sub}</p>
      </div>
    </div>
  </section>

  <section class="paper-sec" id="services-list">
    <div class="kanji ink-stroke" style="left:-6vw;bottom:-10%" aria-hidden="true">業務</div>
    <div class="sec-inner">
      <span class="sec-jp rise">{text.kicker}<span class="font-jp">業務</span></span>
      <h2 class="shear">{#each words(text.heading) as word, i}<span class="w">{word}{i < words(text.heading).length - 1 ? ' ' : ''}</span>{/each}</h2>
      <div class="opt-grid">
        {#each SERVICE_IDS as id (id)}
          {@const content = SERVICE_CONTENT[locale][id]}
          {@const displays = subscriptionDisplays(id)}
          {@const price = packagePrice(id)}
          <article class="opt">
            <span class="opt-jp font-jp">{content.navJp}</span>
            <h3 class="opt-name">{content.navLabel}</h3>
            {#if price}
              <p class="opt-price">{price}</p>
            {:else if isQuoteOnly(id)}
              <p class="opt-price">{text.quoteOnly}</p>
            {/if}
            <p class="opt-per">{displays.length > 0 ? text.monthly : (isQuoteOnly(id) ? text.quoteOnly : text.perProject)}</p>
            <p class="opt-desc">{content.sub}</p>
            {#if displays.length > 0}
              <ul class="opt-list">
                {#each displays as display (display.name)}
                  <li><b>{display.name}</b><span>{display.detail}</span></li>
                {/each}
              </ul>
            {/if}
            <a class="btn btn-ghost-ink" href={SERVICE_ROUTES[id][locale]}>{text.view}</a>
          </article>
        {/each}
      </div>
    </div>
  </section>

  <SubscribeSection locale={locale} />
</div>
