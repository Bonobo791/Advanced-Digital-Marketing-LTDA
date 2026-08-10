<script lang="ts">
  import { onMount } from 'svelte'
  import { browser } from '$app/environment'
  import { page } from '$app/state'
  import { EMAIL, JP, MAILTO } from '$lib/constants'
  import { CHROME_COPY, localeForPath, LOCALE_ROUTES, navigationForLocale, normalizePath } from '$lib/locale'
  import LanguageSwitcher from './LanguageSwitcher.svelte'

  let open = $state(false)
  let hidden = $state(false)
  let pathname = $derived(normalizePath(page.url.pathname))
  let locale = $derived(localeForPath(page.url.pathname))
  let copy = $derived(CHROME_COPY[locale])
  let links = $derived(navigationForLocale(locale))

  $effect(() => {
    if (pathname) open = false
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
        hidden = y > 96 && delta > 4
        if (delta < -4 || y <= 96) hidden = false
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
      <span class="editorial-brand__seal font-jp-serif" aria-hidden="true">{JP.seal}</span><span>ADM//LTDA</span>
    </a>

    <nav class="editorial-nav__links" aria-label={copy.navigationLabel}>
      {#each links as link (link.to)}
        <a href={link.to} aria-current={pathname === normalizePath(link.to) ? 'page' : undefined}>{link.label}</a>
      {/each}
    </nav>

    <div class="editorial-nav__actions">
      <LanguageSwitcher />
      <a class="editorial-nav__cta" href={MAILTO}>{copy.bookCall}</a>
    </div>

    <button type="button" class="editorial-menu-button" aria-expanded={open} aria-controls="mobile-city-menu" onclick={() => (open = !open)}>
      <span>{open ? copy.close : copy.menu}</span>
    </button>
  </div>
</header>

{#if open}
  <div id="mobile-city-menu" class="editorial-mobile-menu">
    <nav aria-label={copy.navigationLabel}>
      {#each links as link (link.to)}
        <a href={link.to} aria-current={pathname === normalizePath(link.to) ? 'page' : undefined}><span>{link.label}</span><small class="font-jp">{link.jp}</small></a>
      {/each}
    </nav>

    <div class="editorial-mobile-menu__footer">
      <LanguageSwitcher />
      <a class="button button--solid" href={MAILTO} onclick={() => (open = false)}>{copy.bookCall}</a>
      <div>{EMAIL}</div><div>{copy.footerTagline}</div>
    </div>
  </div>
{/if}
