<script lang="ts">
  import { getContext, onMount } from 'svelte'
  import cityInk from '$lib/assets/city-ink.jpg'
  import portraitInk from '$lib/assets/andrew-new.jpg'
  import { PAGE_COPY } from '$lib/constants'
  import { SITE_MOTION, type SiteMotion } from '$lib/client/site-motion'
  import { setupReveals } from '$lib/client/reveal'
  import { LOCALE_ROUTES, type Locale } from '$lib/locale'
  import { words } from '$lib/text'

  let { locale }: { locale: Locale } = $props()

  let content = $derived(PAGE_COPY[locale].home)
  // Every contact/quote CTA on the site funnels into the opt-in contact form
  // page (single channel, verified opt-in).
  let contactRoute = $derived(LOCALE_ROUTES.contact[locale])
  let openService = $state(-1)
  const motion = getContext<SiteMotion>(SITE_MOTION)
  // Heading word lists computed once per heading (not per loop iteration).
  let servicesWords = $derived(words(content.servicesHeading))
  let processWords = $derived(words(content.processHeading))
  let whyWords = $derived(words(content.whyHeading))
  let peopleWords = $derived(words(content.peopleHeading))
  let contactWords = $derived(words(content.contactHeading))

  onMount(() => {
    motion.registerHero()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const list = document.querySelector('.index-home .svc-list')
    let autoOpen: IntersectionObserver | undefined
    if (!reduced && list && 'IntersectionObserver' in window && window.matchMedia('(hover: none)').matches) {
      autoOpen = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          openService = 0
          autoOpen?.disconnect()
        }
      }, { threshold: 0.2 })
      autoOpen.observe(list)
    }
    const teardownReveals = setupReveals()
    return () => {
      autoOpen?.disconnect()
      teardownReveals()
    }
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
      <div class="hero-row"><p class="hero-sub" data-hero-reveal style="--hero-delay:440ms">{content.heroSub}</p><div class="cta-row" data-hero-reveal style="--hero-delay:520ms"><a class="btn btn-solid" href={contactRoute}>{content.email}</a><a class="btn btn-ghost" href="#services">{content.explore}</a></div></div>
    </div>
  </section>

  <section class="paper-sec" id="services"><div class="kanji ink-stroke" style="left:-6vw;bottom:-10%" aria-hidden="true">検索</div><div class="sec-inner"><span class="sec-jp rise">{content.servicesLabel}<span class="font-jp">サービス</span></span><h2 class="shear">{#each servicesWords as word, i}<span class="w">{word}{i < servicesWords.length - 1 ? ' ' : ''}</span>{/each}</h2><div class="svc-list">{#each content.services as service, i (service.title)}<div class="svc"><button class="svc-head" type="button" aria-label={service.title + ' ' + content.detailsSuffix} aria-expanded={openService === i} aria-controls={'service-' + i} onclick={() => (openService = openService === i ? -1 : i)}><span class="svc-jp font-jp">{service.jp}</span><span class="svc-en"><b>{service.title}</b><i>{service.line}</i></span><span class="svc-arrow" aria-hidden="true">→</span></button><div id={'service-' + i} class="svc-body"><div class="svc-body-in"><div class="svc-body-grid"><p>{service.detail}</p><div class="svc-tags">{#each service.tags as tag (tag)}<span>{tag}</span>{/each}</div></div><a class="svc-cta" href={contactRoute}>{content.serviceCta}<span aria-hidden="true"> →</span></a></div></div></div>{/each}</div></div></section>

  <section id="process"><div class="kanji" style="right:-5vw;bottom:-14%" aria-hidden="true">工程</div><div class="sec-inner"><span class="sec-jp rise">{content.processLabel}<span class="font-jp">プロセス</span></span><h2 class="shear">{#each processWords as word, i}<span class="w">{word}{i < processWords.length - 1 ? ' ' : ''}</span>{/each}</h2><div class="steps">{#each content.steps as step (step.title)}<div class="step rise"><div class="step-in"><span class="step-jp font-jp">{step.jp}</span><span class="step-en">{step.title}</span><p>{step.text}</p></div></div>{/each}</div><div class="proc-cta rise"><a class="btn btn-solid" href={contactRoute}>{content.audit}</a></div></div></section>

  <section class="paper-sec" id="why"><div class="kanji ink-stroke" style="right:-7vw;top:-10%" aria-hidden="true">強み</div><div class="sec-inner"><span class="sec-jp rise">{content.whyLabel}<span class="font-jp">強み</span></span><h2 class="shear">{#each whyWords as word, i}<span class="w">{word}{i < whyWords.length - 1 ? ' ' : ''}</span>{/each}</h2><div class="why-grid"><div class="why-text wipe"><p class="lead">{content.whyLead} <b>{content.whyLeadStrong}</b>{content.whyLeadAfter}</p></div><figure class="why-img"><img src={cityInk} alt={content.cityAlt} width="1396" height="975" loading="lazy" /></figure></div><div class="reasons">{#each content.reasons as reason (reason.mark)}<div class="reason rise"><span class="num font-jp">{reason.mark}</span><b>{reason.title}</b><p>{reason.text}</p></div>{/each}</div></div></section>

  <section id="people"><div class="kanji" style="left:-6vw;top:-12%" aria-hidden="true">人</div><div class="sec-inner"><span class="sec-jp rise">{content.peopleLabel}<span class="font-jp">人</span></span><h2 class="shear">{#each peopleWords as word, i}<span class="w">{word}{i < peopleWords.length - 1 ? ' ' : ''}</span>{/each}</h2><div class="people-grid"><figure class="p-portrait"><img src={portraitInk} alt={content.portraitAlt} width="1024" height="1440" loading="lazy" /></figure><p class="p-serif font-jp-serif rise">{content.quote}</p><div class="p-bio"><p class="name">Andrew Weilbacher</p><p class="role">{content.role}</p>{#each content.bio as paragraph (paragraph)}<p class="rise">{paragraph}</p>{/each}<a href={contactRoute}>{content.write}</a></div></div></div></section>

  <section class="contact" id="contact"><div class="kanji" style="right:-5vw;bottom:-16%" aria-hidden="true">連絡</div><div class="sec-inner"><span class="sec-jp rise" style="color:var(--ink)">{content.contactLabel}<span class="font-jp">連絡</span></span><h2 class="shear">{#each contactWords as word, i}<span class="w">{word}{i < contactWords.length - 1 ? ' ' : ''}</span>{/each}</h2><p class="c-sub rise">{content.contactSub}</p><a class="cta-hanko rise" href={contactRoute}><span class="seal font-jp">答</span><span class="txt">{content.email}</span></a><a class="c-mail rise" href={contactRoute}><span>{content.emailCta}</span></a></div></section>
</div>
