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
  let serviceNav = $derived([
    {
      id: 'services-index',
      to: locale === 'pt-BR' ? '/pt-br/servicos/' : '/services/',
      label: copy.servicesAll,
      jp: '業務',
    },
    ...serviceNavigation(locale),
  ])
  let currentService = $derived(serviceForPath(pathname))

  // The services-gateway entry has no ServiceId, so aria-current for it must
  // use the plain pathname comparison; service entries use `currentService`.
  const currentNav = (item: { id: string; to: string }) =>
    item.id === 'services-index'
      ? pathname === normalizePath(item.to)
        ? 'page'
        : undefined
      : currentService === item.id
        ? 'page'
        : undefined

  let menuRoot = $state<HTMLDivElement | undefined>()

  const onMenuKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !menuRoot) return
    const focusables = Array.from(menuRoot.querySelectorAll<HTMLElement>('a[href], button'))
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === menuRoot)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

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

  // Focus the first interactive element when the mobile menu opens, and close
  // the menu when the viewport grows back to desktop (releasing menu-lock).
  $effect(() => {
    if (!browser) return
    if (open && menuRoot) {
      menuRoot.querySelector<HTMLElement>('a[href], button')?.focus()
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
    const desktop = window.matchMedia('(min-width: 901px)')
    const onDesktop = (e: MediaQueryListEvent) => {
      if (e.matches) open = false
    }
    if (desktop.addEventListener) desktop.addEventListener('change', onDesktop)
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (desktop.removeEventListener) desktop.removeEventListener('change', onDesktop)
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
            <a href={s.to} aria-current={currentNav(s)}><span class="jp font-jp">{s.jp}</span>{s.label}</a>
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
  <div id="mobile-city-menu" class="editorial-mobile-menu" role="dialog" aria-label={copy.navigationLabel} tabindex="-1" bind:this={menuRoot} onkeydown={onMenuKeydown}>
    <nav aria-label={copy.navigationLabel}>
      {#each links as link (link.to)}
        <a href={link.to} onclick={() => (open = false)} aria-current={!isHome && pathname === normalizePath(link.to) ? 'page' : undefined}><span>{link.label}</span><small class="font-jp">{link.jp}</small></a>
      {/each}
      {#each serviceNav as s (s.to)}
        <a href={s.to} onclick={() => (open = false)} aria-current={currentNav(s)}><span>{s.label}</span><small class="font-jp">{s.jp}</small></a>
      {/each}
    </nav>

    <div class="editorial-mobile-menu__footer">
      <LanguageSwitcher />
      <a class="button button--solid" href={localeMailto} onclick={() => (open = false)}>{copy.bookCall}</a>
      <div>{localeEmail}</div><div>{copy.footerTagline}</div>
    </div>
  </div>
{/if}
