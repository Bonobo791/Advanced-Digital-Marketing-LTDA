<script lang="ts">
  import GlitchWord from '$lib/components/cyber/GlitchWord.svelte'
  import Reveal from '$lib/components/cyber/Reveal.svelte'
  import Rule from '$lib/components/cyber/Rule.svelte'
  import { MAILTO } from '$lib/constants'
  import portrait from '$lib/assets/andrew-portrait.jpg'

  const CAPS = [
    {
      group: 'Search',
      items: ['Technical SEO', 'GEO and AI answer optimization', 'Topical authority mapping', 'Structured data'],
    },
    {
      group: 'Media',
      items: ['Google Ads', 'Meta and LinkedIn', 'TikTok', 'Creative testing systems'],
    },
    {
      group: 'Build',
      items: ['Web design and development', 'Modern headless stacks', 'Core Web Vitals', 'Analytics and measurement'],
    },
  ]

  const FACTS = [
    ['BASE', 'Sao Paulo, BR'],
    ['MARKETS', 'US + Brazil'],
    ['STRUCTURE', 'Owner-operated'],
    ['ENTITY', 'LTDA, CNPJ-registered'],
  ]
</script>

<svelte:head>
  <title>About - Andrew Philip Weilbacher - Advanced Digital Marketing LTDA</title>
</svelte:head>

<!-- HERO -->
<section class="mx-auto flex min-h-[100dvh] max-w-[1400px] items-center px-6 pb-16 pt-24 md:px-12">
  <div class="grid w-full items-center gap-12 md:grid-cols-12">
    <div class="md:col-span-7">
      <p class="mono-label text-[#00e5ff]">The operator</p>
      <h1 class="font-display mt-6 text-[clamp(2.4rem,5.6vw,5rem)] font-bold leading-[0.98] tracking-tight">
        Andrew Philip
        <br />
        <GlitchWord text="Weilbacher" class="text-[#00e5ff] glow-cyan" />
      </h1>
      <p class="mt-6 max-w-[52ch] text-base leading-relaxed text-white/60 md:text-lg">
        Founder and operator of Advanced Digital Marketing LTDA. SEO engineer, web developer, and paid media
        practitioner.
      </p>
    </div>
    <div class="md:col-span-5">
      <Reveal>
        <div class="bracketed chamfer">
          <span class="bk bk-tl"></span><span class="bk bk-tr"></span><span class="bk bk-bl"></span><span class="bk bk-br"></span>
          <img
            src={portrait}
            alt="Stylized tech-noir illustration portrait of Andrew Philip Weilbacher"
            class="block w-full"
          />
        </div>
      </Reveal>
    </div>
  </div>
</section>

<!-- BIO -->
<section class="mx-auto max-w-[1400px] px-6 py-24 md:px-12">
  <div class="max-w-[65ch]">
    <Reveal>
      <h2 class="font-display text-3xl font-bold leading-[1.05] tracking-tight md:text-5xl">
        One person, full stack, two markets.
      </h2>
    </Reveal>
    <Reveal delay={0.08}>
      <p class="mt-8 text-base leading-relaxed text-white/70 md:text-lg">
        Andrew was born in the United States, built his early career between Pennsylvania and Florida, and now
        runs his agency from Sao Paulo, Brazil. Advanced Digital Marketing LTDA is a CNPJ-registered Brazilian
        company serving clients on both sides of the border.
      </p>
    </Reveal>
    <Reveal delay={0.16}>
      <p class="mt-6 text-base leading-relaxed text-white/70 md:text-lg">
        His background is technical: search infrastructure, machine-learning-assisted ranking research, and
        agent-assisted web development. That engineering depth is what clients buy. Strategy, implementation,
        and measurement all come from the same desk.
      </p>
    </Reveal>
    <Reveal delay={0.24}>
      <p class="mt-6 text-base leading-relaxed text-white/70 md:text-lg">
        The agency's edge is GEO: optimizing not just for Google's classic results, but for the AI answer engines
        that increasingly decide which businesses get mentioned at all.
      </p>
    </Reveal>
  </div>
  <Rule class="mt-20" />
</section>

<!-- CAPABILITIES -->
<section class="mx-auto max-w-[1400px] px-6 pb-24 md:px-12">
  <Reveal>
    <h2 class="font-display text-3xl font-bold leading-[1.05] tracking-tight md:text-5xl">Capabilities</h2>
  </Reveal>
  <div class="mt-12 grid gap-12 md:grid-cols-3 md:gap-8">
    {#each CAPS as c, i (c.group)}
      <Reveal delay={i * 0.08}>
        <div class="border-t border-[#00e5ff]/30 pt-6">
          <h3 class="font-mono2 text-[13px] uppercase tracking-[0.18em] text-[#00e5ff]">{c.group}</h3>
          <ul class="mt-5 space-y-3">
            {#each c.items as item (item)}
              <li class="text-sm leading-relaxed text-white/70 md:text-base">{item}</li>
            {/each}
          </ul>
        </div>
      </Reveal>
    {/each}
  </div>
</section>

<!-- FACTS STRIP -->
<section class="border-y border-white/10 bg-[#0d0d10]">
  <div class="mx-auto grid max-w-[1400px] gap-8 px-6 py-14 md:grid-cols-4 md:px-12">
    {#each FACTS as [k, v], i (k)}
      <Reveal delay={i * 0.06}>
        <div>
          <p class="mono-label text-white/40">{k}</p>
          <p class="mt-2 font-mono2 text-[14px] text-[#f2f2f2]">{v}</p>
        </div>
      </Reveal>
    {/each}
  </div>
</section>

<!-- CTA -->
<section class="mx-auto max-w-[1400px] px-6 py-24 text-center md:px-12 md:py-32">
  <Reveal>
    <h2 class="font-display mx-auto max-w-[18ch] text-4xl font-bold leading-[1.02] tracking-tight md:text-6xl">
      Work with the person who does the work.
    </h2>
  </Reveal>
  <Reveal delay={0.1}>
    <a
      href={MAILTO}
      class="chamfer-sm mt-10 inline-block bg-[#00e5ff] px-8 py-4 font-mono2 text-[13px] font-bold uppercase tracking-[0.14em] text-[#04181c] hover:bg-[#5cf0ff]"
    >
      Start a project
    </a>
  </Reveal>
</section>
