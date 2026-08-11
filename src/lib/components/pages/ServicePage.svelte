<script lang="ts">
  import { getContext, onMount } from 'svelte'
  import { EMAIL, JP, PORTUGUESE_EMAIL, PT_MAILTO, MAILTO } from '$lib/constants'
  import { SITE_MOTION, type SiteMotion } from '$lib/client/site-motion'
  import { SERVICE_CONTENT, type ServiceId } from '$lib/services'
  import type { Locale } from '$lib/locale'

  let { locale, service }: { locale: Locale; service: ServiceId } = $props()

  let content = $derived(SERVICE_CONTENT[locale][service])
  let localeEmail = $derived(locale === 'pt-BR' ? PORTUGUESE_EMAIL : EMAIL)
  let localeMailto = $derived(locale === 'pt-BR' ? PT_MAILTO : MAILTO)
  let optionMailto = (subject: string) =>
    `mailto:${locale === 'pt-BR' ? PORTUGUESE_EMAIL : EMAIL}?subject=${encodeURIComponent(subject)}`
  const motion = getContext<SiteMotion>(SITE_MOTION)
  const words = (text: string) => text.trim().split(/\s+/)

  onMount(() => {
    motion.registerHero()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const supportsView = CSS.supports?.('animation-timeline: view()') ?? false
    const revealables = document.querySelectorAll<HTMLElement>('.index-home .rise, .index-home .wipe, .index-home .shear .w')
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
    return () => { observer?.disconnect(); document.documentElement.classList.remove('index-io') }
  })
</script>

<div class="index-home service-page" class:portuguese={locale === 'pt-BR'}>
  <section class="hero index-hero" class:hero-revealed={motion.state.hero === 'revealed'}>
    <div class="hero-bg" aria-hidden="true">
      <div class="kanji k-amb" style="right:-4vw;top:-6%">{content.navJp}</div>
      {#each [['検索・設計・生成・実装・計測・答・未来・', '64s'], ['アドバンスト・デジタル・マーケティング・', '96s'], ['検索・設計・生成・実装・計測・答・未来・', '78s'], ['アドバンスト・デジタル・マーケティング・', '110s'], ['検索・設計・生成・実装・計測・答・未来・', '58s']] as item, i}
        <div class="kcol kc{i + 1}"><span class="kcol-in" style="--spd:{item[1]}">{item[0].repeat(10)}</span></div>
      {/each}
      <div class="haze"></div><div class="scan"></div>
    </div>
    <div class="sec-inner hero-inner">
      <div class="hero-kick"><span class="jp" data-hero-reveal style="--hero-delay:0ms">「答えを、設計する。」</span><span class="en" data-hero-reveal style="--hero-delay:60ms">{content.kicker}</span></div>
      <p class="hero-line1" data-hero-reveal style="--hero-delay:120ms">{content.promise}<b>.</b></p>
      <h1 class="hero-h1"><span class="h-mask"><span class="h-line" data-hero-reveal style="--hero-delay:180ms">{content.hero[0]}</span></span><span class="h-mask"><span class="h-line" data-hero-reveal style="--hero-delay:270ms"><em>{content.hero[1]}</em></span></span></h1>
      <div class="hero-row"><p class="hero-sub" data-hero-reveal style="--hero-delay:440ms">{content.sub}</p><div class="cta-row" data-hero-reveal style="--hero-delay:520ms"><a class="btn btn-solid" href={localeMailto}>{content.bookCall}</a><a class="btn btn-ghost" href="#options">{content.seeOptions}</a></div></div>
    </div>
  </section>

  <section class="paper-sec" id="options"><div class="kanji ink-stroke" style="left:-6vw;bottom:-10%" aria-hidden="true">検索</div><div class="sec-inner"><span class="sec-jp rise">{content.optionsLabel}<span class="font-jp">サービス</span></span><h2 class="shear">{#each words(content.optionsHeading) as word, i}<span class="w">{word}{i < words(content.optionsHeading).length - 1 ? ' ' : ''}</span>{/each}</h2><p class="sec-lead rise">{content.optionsLead}</p><div class="opt-grid">{#each content.options as option, i (option.name)}<article class="opt" class:rec={i === 1}>{#if i === 1}<span class="opt-flag" aria-hidden="true">{content.mostChosen}</span>{/if}<span class="opt-jp font-jp">{option.jp}</span><h3 class="opt-name">{option.name}</h3><p class="opt-price">{option.price}</p><p class="opt-per">{option.per}</p><p class="opt-desc">{option.desc}</p><ul class="opt-list">{#each option.items as item (item)}<li>{item}</li>{/each}</ul><a class="btn {i === 1 ? 'btn-solid' : 'btn-ghost-ink'}" href={optionMailto(option.subject)}>{option.cta}</a></article>{/each}</div><p class="opt-note rise"><b>{content.optionsNoteStrong}</b> {content.optionsNote}</p></div></section>

  <section id="process"><div class="kanji" style="right:-5vw;bottom:-14%" aria-hidden="true">工程</div><div class="sec-inner"><span class="sec-jp rise">{content.processLabel}<span class="font-jp">プロセス</span></span><h2 class="shear">{#each words(content.processHeading) as word, i}<span class="w">{word}{i < words(content.processHeading).length - 1 ? ' ' : ''}</span>{/each}</h2><div class="steps">{#each content.steps as step (step.title)}<div class="step rise"><div class="step-in"><span class="step-jp font-jp">{step.jp}</span><span class="step-en">{step.title}</span><p>{step.text}</p></div></div>{/each}</div><div class="proc-cta rise"><a class="btn btn-solid" href={localeMailto}>{content.auditCta}</a></div></div></section>

  <section class="contact" id="contact"><div class="kanji" style="right:-5vw;bottom:-16%" aria-hidden="true">連絡</div><div class="sec-inner"><span class="sec-jp rise" style="color:var(--ink)">{content.contactLabel}<span class="font-jp">連絡</span></span><h2 class="shear">{#each words(content.contactHeading) as word, i}<span class="w">{word}{i < words(content.contactHeading).length - 1 ? ' ' : ''}</span>{/each}</h2><p class="c-sub rise">{content.contactSub}</p><a class="cta-hanko rise" href={localeMailto}><span class="seal font-jp">{JP.seal}</span><span class="txt">{content.bookCall}</span></a><a class="c-mail rise" href={localeMailto}><span>{localeEmail}</span></a></div></section>
</div>
