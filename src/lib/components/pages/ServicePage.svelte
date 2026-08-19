<script lang="ts">
  import { getContext, onMount } from 'svelte'
  import { page } from '$app/state'
  import { JP } from '$lib/constants'
  import { SITE_MOTION, type SiteMotion } from '$lib/client/site-motion'
  import { setupReveals } from '$lib/client/reveal'
  import { resolveOptionCtaHref, SERVICE_CONTENT, SERVICE_SUBSCRIPTIONS, type ServiceId } from '$lib/services'
  import SubscribeSection from './SubscribeSection.svelte'
  import WebsiteBuildPricing from './WebsiteBuildPricing.svelte'
  import { getService, isServiceId, isSubscribable, formatOptionPrice, type CatalogServiceId } from '$lib/catalog'
  import { LOCALE_ROUTES, type Locale } from '$lib/locale'
  import { words } from '$lib/text'

  let { locale, service }: { locale: Locale; service: ServiceId } = $props()

  let content = $derived(SERVICE_CONTENT[locale][service])
  // Quote-only services (e.g. AI Automation) render a single 'sob consulta'
  // card instead of the options grid — there is no fixed price to subscribe to.
  let quoteOnly = $derived(getService(service)?.pricing.kind === 'quote')
  // Quote/contact CTAs funnel into the opt-in contact form page (single
  // channel); option cards that have a pricing section keep scrolling to it.
  let contactRoute = $derived(LOCALE_ROUTES.contact[locale])
  const motion = getContext<SiteMotion>(SITE_MOTION)

  // The Technical SEO option CTAs carry ?preselect=<catalog-id>#subscribe so
  // the configurator seeds ONLY the clicked option instead of the whole
  // service default set (clicking Content Development must not also preselect
  // Backlinks). Unknown/unsafe values fall back to the service default.
  let preselect = $derived.by(() => {
    const raw = page.url.searchParams.get('preselect')
    const candidate = typeof raw === 'string' && isServiceId(raw) ? getService(raw) : undefined
    return typeof raw === 'string' && candidate && isSubscribable(candidate)
      ? ([raw] as CatalogServiceId[])
      : SERVICE_SUBSCRIPTIONS[service]
  })

  onMount(() => {
    motion.registerHero()
    return setupReveals()
  })
</script>

<div class="index-home service-page" class:portuguese={locale === 'pt-BR'}>
  <section class="hero index-hero" class:hero-revealed={motion.state.hero === 'revealed'}>
    <div class="hero-bg" aria-hidden="true">
      <div class="kanji k-amb" style="right:-4vw;top:-14%">{content.navJp}</div>
      {#each [['検索・設計・生成・実装・計測・答・未来・', '64s'], ['アドバンスト・デジタル・マーケティング・', '96s'], ['検索・設計・生成・実装・計測・答・未来・', '78s'], ['アドバンスト・デジタル・マーケティング・', '110s'], ['検索・設計・生成・実装・計測・答・未来・', '58s']] as item, i}
        <div class="kcol kc{i + 1}"><span class="kcol-in" style="--spd:{item[1]}">{item[0].repeat(10)}</span></div>
      {/each}
      <div class="haze"></div><div class="scan"></div>
    </div>
    <div class="sec-inner hero-inner">
      <div class="hero-kick"><span class="jp" data-hero-reveal style="--hero-delay:0ms">「答えを、設計する。」</span><span class="en" data-hero-reveal style="--hero-delay:60ms">{content.kicker}</span></div>
      <p class="hero-line1" data-hero-reveal style="--hero-delay:120ms">{content.promise}<b>.</b></p>
      <h1 class="hero-h1"><span class="h-mask"><span class="h-line" data-hero-reveal style="--hero-delay:180ms">{content.hero[0]}</span></span><span class="h-mask"><span class="h-line" data-hero-reveal style="--hero-delay:270ms"><em>{content.hero[1]}</em></span></span></h1>
      <div class="hero-row"><p class="hero-sub" data-hero-reveal style="--hero-delay:440ms">{content.sub}</p><div class="cta-row" data-hero-reveal style="--hero-delay:520ms"><a class="btn btn-solid" href={contactRoute}>{content.bookCall}</a><a class="btn btn-ghost" href="#options">{content.seeOptions}</a></div></div>
    </div>
  </section>

  <section class="paper-sec" id="options"><div class="kanji ink-stroke" style="left:-6vw;bottom:-10%" aria-hidden="true">検索</div><div class="sec-inner"><span class="sec-jp rise">{content.optionsLabel}<span class="font-jp">サービス</span></span><h2 class="shear">{#each words(content.optionsHeading) as word, i}<span class="w">{word}{i < words(content.optionsHeading).length - 1 ? ' ' : ''}</span>{/each}</h2><p class="sec-lead rise">{content.optionsLead}</p><div class="opt-grid">{#if quoteOnly}<article class="opt opt--quote"><span class="opt-jp font-jp">{content.options[0].jp}</span><h3 class="opt-name">{content.options[0].name}</h3><p class="opt-price">{content.options[0].priceBRL !== null ? formatOptionPrice(locale, content.options[0].priceBRL) : content.options[0].priceLabel}</p><p class="opt-per">{content.options[0].per}</p><p class="opt-desc">{content.options[0].desc}</p><ul class="opt-list">{#each content.options[0].items as item (item)}<li>{item}</li>{/each}</ul><a class="btn btn-solid" href={resolveOptionCtaHref(content.options[0], content, contactRoute)}>{content.options[0].cta}</a></article>{:else}{#each content.options as option (option.name)}{@const ctaHref = resolveOptionCtaHref(option, content, contactRoute)}<article class="opt" class:rec={!!option.flag}>{#if option.flag}<span class="opt-flag">{option.flag}</span>{/if}<span class="opt-jp font-jp">{option.jp}</span><h3 class="opt-name">{option.name}</h3><p class="opt-price">{option.priceBRL !== null ? formatOptionPrice(locale, option.priceBRL) : option.priceLabel}</p><p class="opt-per">{option.per}</p><p class="opt-desc">{option.desc}</p><ul class="opt-list">{#each option.items as item (item)}<li>{item}</li>{/each}</ul><a class="btn {option.flag ? 'btn-solid' : 'btn-ghost-ink'}" href={ctaHref}>{option.cta}</a></article>{/each}{/if}</div><p class="opt-note rise"><b>{content.optionsNoteStrong}</b> {content.optionsNote}</p></div></section>

  {#if service === 'web-development'}
    <WebsiteBuildPricing {locale} />
  {/if}

  {#if SERVICE_SUBSCRIPTIONS[service].length > 0}
    <SubscribeSection locale={locale} preselect={preselect} />
  {/if}

  <section id="process"><div class="kanji" style="right:-5vw;bottom:-14%" aria-hidden="true">工程</div><div class="sec-inner"><span class="sec-jp rise">{content.processLabel}<span class="font-jp">プロセス</span></span><h2 class="shear">{#each words(content.processHeading) as word, i}<span class="w">{word}{i < words(content.processHeading).length - 1 ? ' ' : ''}</span>{/each}</h2><div class="steps">{#each content.steps as step (step.title)}<div class="step rise"><div class="step-in"><span class="step-jp font-jp">{step.jp}</span><span class="step-en">{step.title}</span><p>{step.text}</p></div></div>{/each}</div><div class="proc-cta rise"><a class="btn btn-solid" href={contactRoute}>{content.auditCta}</a></div></div></section>

  <section class="contact" id="contact"><div class="kanji" style="right:-5vw;bottom:-16%" aria-hidden="true">連絡</div><div class="sec-inner"><span class="sec-jp rise" style="color:var(--ink)">{content.contactLabel}<span class="font-jp">連絡</span></span><h2 class="shear">{#each words(content.contactHeading) as word, i}<span class="w">{word}{i < words(content.contactHeading).length - 1 ? ' ' : ''}</span>{/each}</h2><p class="c-sub rise">{content.contactSub}</p><a class="cta-hanko rise" href={contactRoute}><span class="seal font-jp">{JP.seal}</span><span class="txt">{content.bookCall}</span></a><a class="c-mail rise" href={contactRoute}><span>{content.bookCall}</span></a></div></section>
</div>
