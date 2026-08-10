<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { fly } from 'svelte/transition'
  import { expoOut } from 'svelte/easing'
  import { JP, LINKS, MAILTO } from '$lib/constants'
  import logoMark from '$lib/assets/adm-logo-mark.png'
  import Scramble from '../cyber/Scramble.svelte'

  let open = $state(false)
  let reduced = $state(false)

  let pathname = $derived(page.url.pathname.replace(/\/+$/, '') || '/')

  $effect(() => {
    if (pathname) open = false
  })

  onMount(() => {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
</script>

<header class="fixed inset-x-0 top-0 z-[60] border-b border-white/10 bg-[#151a20]/92 backdrop-blur-md">
  <div class="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 md:px-12">
    <a href="/" class="flex items-center gap-3 font-mono2 text-sm font-bold tracking-[0.18em] text-[#eef2ef]" aria-label="Advanced Digital Marketing LTDA - home">
      <img src={logoMark} alt="" class="h-6 w-6" width="1560" height="1560" />
      <span>ADM<span class="text-[#e66757]">//</span>LTDA</span>
      <span class="hidden font-jp text-[10px] font-bold tracking-[0.16em] text-white/30 lg:inline">先進</span>
    </a>

    <nav class="hidden items-center gap-8 md:flex" aria-label="Primary">
      {#each LINKS as l (l.to)}
        {@const active = pathname === l.to}
        <a
          href={l.to}
          class="font-mono2 text-[12px] uppercase tracking-[0.18em] {active
            ? 'text-[#76d7dd]'
            : 'text-white/60 hover:text-white'}"
          aria-current={active ? 'page' : undefined}
        >
          <Scramble text={l.label} />
          <span class="ml-1 font-jp text-[10px] normal-case tracking-normal text-white/25">{l.jp}</span>
        </a>
      {/each}
      <a
        href={MAILTO}
        class="chamfer-sm bg-[#76d7dd] px-5 py-2.5 font-mono2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#172025] hover:bg-[#a4eef0]"
      >
        Start a project
      </a>
    </nav>

    <button
      class="flex h-10 w-10 items-center justify-center text-white md:hidden"
      onclick={() => (open = !open)}
      aria-label={open ? 'Close menu' : 'Open menu'}
      aria-expanded={open}
    >
      {#if open}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      {:else}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      {/if}
    </button>
  </div>

  {#if open}
    <nav
      aria-label="Mobile"
      class="border-t border-white/10 bg-[#151a20] md:hidden"
      in:fly={{ y: reduced ? 0 : -8, duration: reduced ? 0 : 200, easing: expoOut, opacity: reduced ? 1 : 0 }}
      out:fly={{ y: reduced ? 0 : -8, duration: reduced ? 0 : 120, easing: expoOut, opacity: reduced ? 1 : 0 }}
    >
      <div class="flex flex-col gap-1 px-6 py-4">
        {#each LINKS as l (l.to)}
          {@const active = pathname === l.to}
          <a
            href={l.to}
            class="flex items-baseline justify-between py-3 font-mono2 text-[13px] uppercase tracking-[0.18em] {active ? 'text-[#76d7dd]' : 'text-white/70'}"
            aria-current={active ? 'page' : undefined}
          >
            <span>{l.label}</span>
            <span class="font-jp text-[11px] normal-case tracking-normal text-white/30">{l.jp}</span>
          </a>
        {/each}
        <a
          href={MAILTO}
          class="chamfer-sm mt-2 inline-flex w-fit bg-[#76d7dd] px-5 py-2.5 font-mono2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#172025]"
        >
          Start a project
        </a>
      </div>
    </nav>
  {/if}
</header>
