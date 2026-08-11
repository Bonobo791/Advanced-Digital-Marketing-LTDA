<script lang="ts">
  import { onMount } from 'svelte'
  import { browser } from '$app/environment'
  import { page } from '$app/state'
  import { EMAIL, JP, PORTUGUESE_EMAIL, PT_MAILTO, MAILTO } from '$lib/constants'
  import { CHROME_COPY, homeSectionsForLocale, localeForPath, LOCALE_ROUTES, navigationForLocale, normalizePath } from '$lib/locale'
  import { serviceForPath, serviceNavigation } from '$lib/services'
  import LanguageSwitcher from './LanguageSwitcher.svelte'

  let open = $state(false)
  let hidden = $state(false)
  let svcOpen = $state(false)
  let pathname = $derived(normalizePath(page.url.pathname))
  let locale = $derived(localeForPath(page.url.pathname))
  let copy = $derived(CHROME_COPY[locale])
  let localeMailto = $derived(locale === 'pt-BR' ? PT_MAILTO : MAILTO)
  let localeEmail = $derived(locale === 'pt-BR' ? PORTUGUESE_EMAIL : EMAIL)
  let isHome = $derived(pathname === normalizePath(LOCALE_ROUTES.home[locale]))
  let links = $derived(isHome ? homeSectionsForLocale(locale).filter((l) => !l.to.includes('#services')) : navigationForLocale(locale))
  let serviceNav = $derived(serviceNavigation(locale))
  let currentService = $derived(serviceForPath(pathname))

  const svcToggle = (e: MouseEvent) => {
    e.stopPropagation()
    svcOpen = !svcOpen
  }

  $effect(() => {
    if (pathname) {
      open = false
      svcOpen = false
    }
  })

  $effect(() => {
    if (!browser) return
    document.body.classList.toggle('menu-lock', open)
    return () => {
      document.body.classList.remove('menu-lock')
    }
  })

  onMount(() => {
    let lastY = window.scrollY
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        const y = window.scrollY
        const delta = y - lastY
        hidden = y > 140 && delta > 4
        if (delta < -4 || y <= 140) hidden = false
        lastY = y
        frame = 0
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
      document.body.classList.remove('menu-lock')
    }
  })
</script>

<header class="editorial-nav" class:editorial-nav--hidden={hidden && !open}>
  <div class="editorial-nav__inner">
    <a class="editorial-brand" href={LOCALE_ROUTES.home[locale]} aria-label={`Advanced Digital Marketing LTDA ${copy.navigation.home}`}>
      <span class="editorial-brand__seal font-jp" aria-hidden="true">{JP.seal}</span><span>ADM</span>
    </a>

    <nav class="editorial-nav__links" aria-label={copy.navigationLabel}>
      <div class="nav-svc" class:open={svcOpen}>
        <button class="nav-svc-btn" type="button" aria-haspopup="true" aria-expanded={svcOpen} onclick={svcToggle}>{copy.services} <span class="caret" aria-hidden="true"></span></button>
        <div class="svc-menu">
          {#each serviceNav as s (s.to)}
            <a href={s.to} aria-current={currentService === s.id ? 'page' : undefined}><span class="jp font-jp">{s.jp}</span>{s.label}</a>
          {/each}
        </div>
      </div>
      {#each links as link (link.to)}
        <a href={link.to} aria-current={!isHome && pathname === normalizePath(link.to) ? 'page' : undefined}>{link.label}</a>
      {/each}
    </nav>

    <div class="editorial-nav__actions">
      <LanguageSwitcher />
    </div>

    <button type="button" class="editorial-menu-button" aria-expanded={open} aria-controls="mobile-city-menu" onclick={() => (open = !open)}>
      <span>{open ? copy.close : copy.menu}</span>
    </button>
  </div>
</header>

<svelte:window
  onclick={(e) => {
    if (svcOpen && e.target instanceof Element && !e.target.closest('.nav-svc')) svcOpen = false
  }}
  onkeydown={(e) => {
    if (e.key === 'Escape') svcOpen = false
  }}
/>

{#if open}
  <div id="mobile-city-menu" class="editorial-mobile-menu">
    <nav aria-label={copy.navigationLabel}>
      {#each links as link (link.to)}
        <a href={link.to} aria-current={!isHome && pathname === normalizePath(link.to) ? 'page' : undefined}><span>{link.label}</span><small class="font-jp">{link.jp}</small></a>
      {/each}
      {#each serviceNav as s (s.to)}
        <a href={s.to} aria-current={currentService === s.id ? 'page' : undefined}><span>{s.label}</span><small class="font-jp">{s.jp}</small></a>
      {/each}
    </nav>

    <div class="editorial-mobile-menu__footer">
      <LanguageSwitcher />
      <a class="button button--solid" href={localeMailto} onclick={() => (open = false)}>{copy.bookCall}</a>
      <div>{localeEmail}</div><div>{copy.footerTagline}</div>
    </div>
  </div>
{/if}
