<script lang="ts">
  import Terminal from '$lib/components/cyber/Terminal.svelte'
  import GlitchWord from '$lib/components/cyber/GlitchWord.svelte'
  import Reveal from '$lib/components/cyber/Reveal.svelte'
  import Rule from '$lib/components/cyber/Rule.svelte'
  import Scramble from '$lib/components/cyber/Scramble.svelte'
  import { MAILTO } from '$lib/constants'
  import dataCity from '$lib/assets/data-city.jpg'

  const BOOT_LINES = [
    { prompt: '>', text: 'boot adm.core .......... ok' },
    { prompt: '>', text: 'crawling google serps .. ok' },
    { prompt: '>', text: 'reading ai answers ..... ok' },
    { prompt: '>', text: 'modules: seo_geo / paid_search /' },
    { text: 'paid_social / web_design' },
    { prompt: '>', text: 'queue: accepting new projects' },
  ]

  const PLATFORMS = [
    { slug: 'google', name: 'Google' },
    { slug: 'meta', name: 'Meta' },
    { slug: 'instagram', name: 'Instagram' },
    { slug: 'tiktok', name: 'TikTok' },
    { slug: 'wordpress', name: 'WordPress' },
    { slug: 'shopify', name: 'Shopify' },
  ]

  const SERVICES = [
    {
      key: '[SEO+GEO]',
      name: 'SEO & GEO',
      outcome: 'Rank in Google. Get cited by the AI answer engines.',
      detail:
        'Technical SEO audits, topical authority maps, structured data, and answer-first content engineered so Google AI Overviews, ChatGPT, and Perplexity can extract and cite you.',
    },
    {
      key: '[PAID_SEARCH]',
      name: 'Paid Search',
      outcome: 'Google Ads that buy revenue, not clicks.',
      detail:
        'Account restructuring, query-level negative sculpting, and landing-page message match. Every ad group is tied to a conversion you can bank.',
    },
    {
      key: '[PAID_SOCIAL]',
      name: 'Paid Social',
      outcome: 'Creative-tested campaigns on Meta, LinkedIn, and TikTok.',
      detail:
        'Hook-first ad creative, structured testing matrices, and audience systems that find buyers instead of burning budget on lookalikes that never convert.',
    },
    {
      key: '[WEB_DESIGN]',
      name: 'Web Design',
      outcome: 'Sites built to rank, convert, and load fast.',
      detail:
        'Design and development on modern stacks, shipped with Core Web Vitals in the green, clean information architecture, and analytics wired from day one.',
    },
  ]

  const STEPS = [
    {
      n: '01',
      verb: 'Audit',
      text: 'We map how Google and the AI engines currently see your business, then find the gaps your competitors left open.',
    },
    {
      n: '02',
      verb: 'Build',
      text: 'Search infrastructure, campaigns, and pages shipped in weekly cycles, each one measured against revenue.',
    },
    {
      n: '03',
      verb: 'Compound',
      text: 'Winners get scaled, losers get killed. The system learns your market month over month.',
    },
  ]

  const DIFFS = [
    {
      title: 'GEO-first, not GEO-later',
      text: 'Most agencies still optimize for ten blue links. We optimize for the answer engines your buyers ask first, with classic SEO as the foundation underneath.',
    },
    {
      title: 'Owner-operated',
      text: 'The person on the call is the person doing the work. No account-manager relay, no junior handoffs, no telephone game with your budget.',
    },
    {
      title: 'Two markets, one desk',
      text: 'US-market playbooks executed from a Brazilian LTDA. Bilingual delivery for companies operating across the US and Brazil.',
    },
  ]
</script>

<!-- HERO -->
<section class="mx-auto flex min-h-[100dvh] max-w-[1400px] items-center px-6 pb-16 pt-24 md:px-12">
  <div class="grid w-full items-center gap-12 md:grid-cols-12">
    <div class="md:col-span-7">
      <p class="mono-label text-[#00e5ff]">Advanced Digital Marketing LTDA</p>
      <h1 class="font-display mt-6 text-[clamp(2.5rem,4.6vw,3.5rem)] font-bold leading-[1.02] tracking-tight">
        Search is changing. We make sure you get <GlitchWord text="found." class="text-[#00e5ff] glow-cyan" />
      </h1>
      <p class="mt-6 max-w-[52ch] text-base leading-relaxed text-white/60 md:text-lg">
        One senior operator for SEO, GEO, paid search, paid social, and web design.
      </p>
      <div class="mt-8 flex flex-wrap items-center gap-4">
        <a
          href={MAILTO}
          class="chamfer-sm bg-[#00e5ff] px-7 py-3.5 font-mono2 text-[13px] font-bold uppercase tracking-[0.14em] text-[#04181c] hover:bg-[#5cf0ff]"
        >
          Start a project
        </a>
        <a
          href="#services"
          class="chamfer-sm border border-white/20 px-7 py-3.5 font-mono2 text-[13px] uppercase tracking-[0.14em] text-white/80 hover:border-[#00e5ff] hover:text-[#00e5ff]"
        >
          See services
        </a>
      </div>
    </div>
    <div class="md:col-span-5">
      <Terminal title="adm.core - session" lines={BOOT_LINES} />
    </div>
  </div>
</section>

<!-- SYSTEMS STRIP -->
<section class="border-y border-white/10">
  <div class="mx-auto max-w-[1400px] px-6 py-10 md:px-12">
    <p class="mono-label text-center text-white/40">Operating across</p>
    <div class="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
      {#each PLATFORMS as p (p.slug)}
        <img
          src="https://cdn.simpleicons.org/{p.slug}/ffffff"
          alt={p.name}
          class="h-6 w-6 opacity-50 transition-opacity duration-300 hover:opacity-100 md:h-7 md:w-7"
          loading="lazy"
        />
      {/each}
    </div>
  </div>
</section>

<!-- SERVICES -->
<section id="services" class="mx-auto max-w-[1400px] scroll-mt-24 px-6 py-24 md:px-12 md:py-32">
  <Reveal>
    <h2 class="font-display max-w-[16ch] text-4xl font-bold leading-[1.02] tracking-tight md:text-6xl">
      Four modules. One growth system.
    </h2>
    <p class="mt-5 max-w-[60ch] text-base leading-relaxed text-white/60">
      Every engagement runs on the same loop: find the gap, ship the fix, measure the money.
    </p>
  </Reveal>
  <Rule class="mt-12" />
  <div class="mt-2">
    {#each SERVICES as s, i (s.key)}
      <Reveal delay={i * 0.06}>
        <div class="ledger-row group border-b border-white/10 py-8 md:py-10">
          <div class="grid items-baseline gap-3 md:grid-cols-12 md:gap-6">
            <span class="font-mono2 text-[12px] text-[#00e5ff] md:col-span-2">{s.key}</span>
            <h3 class="font-display text-2xl font-bold tracking-tight md:col-span-4 md:text-4xl">
              <Scramble text={s.name} />
            </h3>
            <p class="text-sm leading-relaxed text-white/50 md:col-span-5 md:text-base">{s.outcome}</p>
            <span class="hidden justify-self-end text-[#00e5ff] md:col-span-1 md:block">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="square"
                aria-hidden="true"
                class="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              >
                <path d="M7 17L17 7M17 7H8M17 7v9" />
              </svg>
            </span>
          </div>
          <div class="ledger-detail">
            <div>
              <p class="max-w-[65ch] pt-4 text-sm leading-relaxed text-white/60">{s.detail}</p>
            </div>
          </div>
        </div>
      </Reveal>
    {/each}
  </div>
</section>

<!-- HOW IT WORKS -->
<section class="border-y border-white/10 bg-[#0d0d10]">
  <div class="mx-auto max-w-[1400px] px-6 py-24 md:px-12 md:py-32">
    <Reveal>
      <h2 class="font-display max-w-[18ch] text-4xl font-bold leading-[1.02] tracking-tight md:text-6xl">
        How an engagement runs
      </h2>
    </Reveal>
    <div class="mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
      {#each STEPS as s, i (s.n)}
        <Reveal delay={i * 0.08}>
          <div class="border-t border-[#00e5ff]/30 pt-6">
            <span class="font-mono2 text-[13px] text-[#00e5ff]">{s.n}</span>
            <h3 class="font-display mt-3 text-2xl font-bold tracking-tight">{s.verb}</h3>
            <p class="mt-3 text-sm leading-relaxed text-white/60">{s.text}</p>
          </div>
        </Reveal>
      {/each}
    </div>
  </div>
</section>

<!-- WHY US -->
<section class="mx-auto max-w-[1400px] px-6 py-24 md:px-12 md:py-32">
  <div class="grid gap-16 md:grid-cols-12">
    <div class="md:col-span-5">
      <Reveal>
        <h2 class="font-display text-4xl font-bold leading-[1.02] tracking-tight md:text-5xl">
          The agency model, rebuilt for AI search.
        </h2>
      </Reveal>
      <Reveal delay={0.1}>
        <div class="bracketed chamfer mt-10">
          <span class="bk bk-tl"></span><span class="bk bk-tr"></span><span class="bk bk-bl"></span><span class="bk bk-br"></span>
          <img src={dataCity} alt="Visualization of search data flowing through a city-scale network" class="block w-full" loading="lazy" />
        </div>
        <p class="mt-3 font-mono2 text-[11px] uppercase tracking-[0.18em] text-white/30">
          Your market is a network. We make it route to you.
        </p>
      </Reveal>
    </div>
    <div class="md:col-span-7">
      {#each DIFFS as d, i (d.title)}
        <Reveal delay={i * 0.08}>
          <div class="py-8 {i > 0 ? 'border-t border-white/10' : ''}">
            <h3 class="font-display text-xl font-bold tracking-tight text-[#f2f2f2] md:text-2xl">{d.title}</h3>
            <p class="mt-3 max-w-[58ch] text-sm leading-relaxed text-white/60 md:text-base">{d.text}</p>
          </div>
        </Reveal>
      {/each}
    </div>
  </div>
</section>

<!-- FINAL CTA -->
<section class="border-t border-white/10 bg-[#0d0d10]">
  <div class="mx-auto max-w-[1400px] px-6 py-24 text-center md:px-12 md:py-32">
    <Reveal>
      <h2 class="font-display mx-auto max-w-[16ch] text-4xl font-bold leading-[1.02] tracking-tight md:text-6xl">
        Be the <span class="text-[#00e5ff] glow-cyan">answer</span>, not another blue link.
      </h2>
    </Reveal>
    <Reveal delay={0.1}>
      <div class="mt-10 flex flex-col items-center gap-5">
        <a
          href={MAILTO}
          class="chamfer-sm bg-[#00e5ff] px-8 py-4 font-mono2 text-[13px] font-bold uppercase tracking-[0.14em] text-[#04181c] hover:bg-[#5cf0ff]"
        >
          Start a project
        </a>
        <span class="break-all font-mono2 text-[12px] text-white/40">contact@marketingprowess.simplelogin.com</span>
      </div>
    </Reveal>
  </div>
</section>
