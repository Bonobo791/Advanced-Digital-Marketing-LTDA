<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { fly } from 'svelte/transition'
  import { expoOut } from 'svelte/easing'
  import { LINKS, MAILTO } from '$lib/constants'
  import Scramble from '../cyber/Scramble.svelte'

  let open = false
  let reduced = false

  $: pathname = $page.url.pathname.replace(/\/+$/, '') || '/'
  $: if (pathname) open = false

  onMount(() => {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
</script>

<header class="fixed inset-x-0 top-0 z-[60] border-b border-white/10 bg-[#0a0a0b]/85 backdrop-blur-md">
  <div class="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 md:px-12">
    <a href="/" class="font-mono2 text-sm font-bold tracking-[0.18em] text-[#f2f2f2]" aria-label="Advanced Digital Marketing LTDA - home">
      ADM<span class="text-[#00e5ff]">//</span>LTDA
    </a>

    <nav class="hidden items-center gap-8 md:flex" aria-label="Primary">
      {#each LINKS as l (l.to)}
        {@const active = pathname === l.to}
        <a
          href={l.to}
          class="font-mono2 text-[12px] uppercase tracking-[0.18em] {active
            ? 'text-[#00e5ff]'
            : 'text-white/60 hover:text-white'}"
          aria-current={active ? 'page' : undefined}
        >
          <Scramble text={l.label} />
        </a>
      {/each}
      <a
        href={MAILTO}
        class="chamfer-sm bg-[#00e5ff] px-5 py-2.5 font-mono2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#04181c] hover:bg-[#5cf0ff]"
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
      class="border-t border-white/10 bg-[#0a0a0b] md:hidden"
      in:fly={{ y: reduced ? 0 : -8, duration: reduced ? 0 : 200, easing: expoOut, opacity: reduced ? 1 : 0 }}
      out:fly={{ y: reduced ? 0 : -8, duration: reduced ? 0 : 120, easing: expoOut, opacity: reduced ? 1 : 0 }}
    >
      <div class="flex flex-col gap-1 px-6 py-4">
        {#each LINKS as l (l.to)}
          {@const active = pathname === l.to}
          <a
            href={l.to}
            class="py-3 font-mono2 text-[13px] uppercase tracking-[0.18em] {active ? 'text-[#00e5ff]' : 'text-white/70'}"
            aria-current={active ? 'page' : undefined}
          >
            {l.label}
          </a>
        {/each}
        <a
          href={MAILTO}
          class="chamfer-sm mt-2 inline-flex w-fit bg-[#00e5ff] px-5 py-2.5 font-mono2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#04181c]"
        >
          Start a project
        </a>
      </div>
    </nav>
  {/if}
</header>
