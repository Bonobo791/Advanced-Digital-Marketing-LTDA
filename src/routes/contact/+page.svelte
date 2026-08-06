<script lang="ts">
  import GlitchWord from '$lib/components/cyber/GlitchWord.svelte'
  import Reveal from '$lib/components/cyber/Reveal.svelte'
  import Rule from '$lib/components/cyber/Rule.svelte'
  import { EMAIL, MAILTO } from '$lib/constants'

  const TIPS = [
    { k: 'GOAL', text: 'What outcome you want: more qualified traffic, better conversion, a site that ranks, or all three.' },
    { k: 'URL', text: 'Your current site, if you have one. The audit starts there.' },
    { k: 'TIMELINE', text: 'When you need results by, and what a win looks like for you.' },
  ]
</script>

<svelte:head>
  <title>Contact - Advanced Digital Marketing LTDA</title>
</svelte:head>

<!-- HERO -->
<section class="mx-auto flex min-h-[100dvh] max-w-[1400px] items-center px-6 pb-16 pt-24 md:px-12">
  <div class="grid w-full items-start gap-12 md:grid-cols-12">
    <div class="md:col-span-6">
      <p class="mono-label text-[#00e5ff]">Contact</p>
      <h1 class="font-display mt-6 text-[clamp(2.6rem,5.8vw,5.25rem)] font-bold leading-[0.98] tracking-tight">
        Open a <GlitchWord text="channel." class="text-[#00e5ff] glow-cyan" />
      </h1>
      <p class="mt-6 max-w-[52ch] text-base leading-relaxed text-white/60 md:text-lg">
        One inbox, no intake form, no account manager. Every message lands directly with the owner.
      </p>
      <div class="mt-10">
        <a
          href={MAILTO}
          class="chamfer-sm inline-flex items-center gap-3 bg-[#00e5ff] px-8 py-4 font-mono2 text-[13px] font-bold uppercase tracking-[0.14em] text-[#04181c] hover:bg-[#5cf0ff]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" />
            <path d="M3 6l9 7 9-7" />
          </svg>
          Start a project
        </a>
        <p class="mt-4 break-all font-mono2 text-[13px] text-white/50">{EMAIL}</p>
      </div>
    </div>

    <div class="md:col-span-6">
      <Reveal>
        <div class="bracketed chamfer border border-white/10 bg-[#101014]">
          <span class="bk bk-tl"></span><span class="bk bk-tr"></span><span class="bk bk-bl"></span><span class="bk bk-br"></span>
          <div class="flex items-center gap-2 border-b border-white/10 px-5 py-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" class="text-[#00e5ff]" aria-hidden="true">
              <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            <span class="font-mono2 text-[11px] uppercase tracking-[0.22em] text-white/50">Registered office</span>
          </div>
          <div class="px-5 py-6">
            <p class="font-display text-lg font-bold tracking-tight text-[#f2f2f2]">
              Advanced Digital Marketing LTDA
            </p>
            <address class="mt-4 font-mono2 text-[14px] not-italic leading-[2] text-white/70">
              AV PAULISTA 777<br />
              ANDAR 15 CONJ 15 SALA 3408<br />
              SAO PAULO, SP<br />
              01311-914
            </address>
            <div class="mt-6 border-t border-white/10 pt-4">
              <p class="font-mono2 text-[12px] text-white/40">
                <span class="text-[#00e5ff]">&gt; </span>channel: open<span class="cursor-block"></span>
              </p>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  </div>
</section>

<!-- WHAT TO INCLUDE -->
<section class="mx-auto max-w-[1400px] px-6 py-24 md:px-12">
  <Reveal>
    <h2 class="font-display max-w-[20ch] text-3xl font-bold leading-[1.05] tracking-tight md:text-5xl">
      Three things that make the first reply useful
    </h2>
  </Reveal>
  <Rule class="mt-12" />
  <div class="mt-2">
    {#each TIPS as t, i (t.k)}
      <Reveal delay={i * 0.06}>
        <div class="grid items-baseline gap-2 border-b border-white/10 py-8 md:grid-cols-12 md:gap-6">
          <span class="font-mono2 text-[12px] text-[#00e5ff] md:col-span-2">[{t.k}]</span>
          <p class="text-sm leading-relaxed text-white/70 md:col-span-10 md:text-base">{t.text}</p>
        </div>
      </Reveal>
    {/each}
  </div>
  <Reveal delay={0.2}>
    <a
      href={MAILTO}
      class="chamfer-sm mt-12 inline-block bg-[#00e5ff] px-8 py-4 font-mono2 text-[13px] font-bold uppercase tracking-[0.14em] text-[#04181c] hover:bg-[#5cf0ff]"
    >
      Start a project
    </a>
  </Reveal>
</section>
