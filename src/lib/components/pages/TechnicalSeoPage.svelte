<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { setupReveals } from '$lib/client/reveal'
  import { resolveServicePreselect } from '$lib/services'
  import { TECHNICAL_SEO_UI_COPY } from '$lib/constants'
  import type { Locale } from '$lib/locale'
  import type { TechnicalSeoContent } from '$lib/technical-seo'
  import ServiceOptions from './ServiceOptions.svelte'
  import SubscribeSection from './SubscribeSection.svelte'

  let { content, locale }: { content: TechnicalSeoContent; locale: Locale } = $props()
  let text = $derived(TECHNICAL_SEO_UI_COPY[locale])
  let preselect = $derived(resolveServicePreselect('technical-seo', page.url.searchParams.get('preselect')))

  onMount(setupReveals)
</script>

<div class="index-home service-page seo-page" class:portuguese={locale === 'pt-BR'}>
  <section class="seo-hero" aria-labelledby="seo-title">
    <div class="seo-hero__mark font-jp" aria-hidden="true">検索</div>
    <div class="seo-wrap seo-hero__grid">
      <div>
        <p class="seo-eyebrow">{text.eyebrow}</p>
        <h1 id="seo-title">{content.title}</h1>
        <div class="seo-copy seo-hero__intro">{@html content.intro}</div>
        <a class="seo-secondary" href="#options">{text.seeOptions} <span aria-hidden="true">↘</span></a>
      </div>
      <aside class="seo-workflow" aria-label={text.workflowLabel}>
        <p class="seo-eyebrow">{text.workflowHeading}</p>
        <ol>
          <li><span>01</span><div><b>{text.diagnose}</b><p>{text.diagnoseDetail}</p></div></li>
          <li><span>02</span><div><b>{text.agree}</b><p>{text.agreeDetail}</p></div></li>
          <li><span>03</span><div><b>{text.verify}</b><p>{text.verifyDetail}</p></div></li>
        </ol>
      </aside>
    </div>
  </section>

  <nav class="seo-jumps" aria-label={text.onPage}>
    <div class="seo-wrap">
      <span>{text.onPage}</span>
      <a href="#scope">{text.scope}</a>
      <a href="#example">{text.example}</a>
      <a href="#deliverables">{text.deliverables}</a>
      <a href="#options">{text.pricing}</a>
      <a href="#faq">{text.faqs}</a>
    </div>
  </nav>

  <section class="seo-section seo-symptoms" aria-labelledby="symptoms-title">
    <div class="seo-wrap">
      <p class="seo-eyebrow">{text.symptoms}</p>
      <h2 id="symptoms-title">{content.symptoms.heading}</h2>
      <div class="seo-copy">{@html content.symptoms.html}</div>
    </div>
  </section>

  <section class="seo-section" id="scope" aria-labelledby="scope-title">
    <div class="seo-wrap">
      <p class="seo-eyebrow">{text.scope}</p>
      <h2 id="scope-title">{content.scopeHeading}</h2>
      <div class="seo-scope">
        {#each content.scope as item, index (item.heading)}
          <article class="seo-scope__row">
            <div class="seo-scope__heading">
              <span class="seo-number">0{index + 1}</span>
              <h3>{item.heading}</h3>
            </div>
            <div class="seo-copy">{@html item.html}</div>
          </article>
        {/each}
      </div>
    </div>
  </section>

  <section class="seo-section seo-example" id="example" aria-labelledby="example-title">
    <div class="seo-wrap">
      <p class="seo-eyebrow">{text.synthetic}</p>
      <h2 id="example-title">{content.example.heading}</h2>
      <div class="seo-copy">{@html content.example.html}</div>
    </div>
  </section>

  <section class="seo-section seo-deliverables" id="deliverables" aria-labelledby="deliverables-title">
    <div class="seo-wrap seo-split">
      <div>
        <p class="seo-eyebrow">{text.inspectable}</p>
        <h2 id="deliverables-title">{content.deliverables.heading}</h2>
      </div>
      <div class="seo-copy">{@html content.deliverables.html}</div>
    </div>
  </section>

  <ServiceOptions {locale} service="technical-seo" />
  <SubscribeSection {locale} {preselect} />

  <section class="seo-section seo-access" id="scope-and-fees" aria-labelledby="access-title">
    <div class="seo-wrap seo-split">
      <div>
        <p class="seo-eyebrow">{text.beforeWork}</p>
        <h2 id="access-title">{content.access.heading}</h2>
      </div>
      <div class="seo-copy">{@html content.access.html}</div>
    </div>
  </section>

  <section class="seo-section seo-faq" id="faq" aria-labelledby="faq-title">
    <div class="seo-wrap seo-split">
      <div>
        <p class="seo-eyebrow">{text.questions}</p>
        <h2 id="faq-title">{content.faqHeading}</h2>
      </div>
      <div>
        {#each content.faqs as faq (faq.heading)}
          <details>
            <summary>{faq.heading}<span aria-hidden="true">+</span></summary>
            <div class="seo-copy">{@html faq.html}</div>
          </details>
        {/each}
      </div>
    </div>
  </section>

  <section class="seo-section seo-contact" id="contact" aria-labelledby="contact-title">
    <div class="seo-wrap seo-split">
      <h2 id="contact-title">{content.contact.heading}</h2>
      <div class="seo-copy">{@html content.contact.html}</div>
    </div>
  </section>
</div>

<style>
  :global(body:has(.seo-page) .editorial-nav) { background: var(--ink); border-bottom: 1px solid var(--paper-faint); }
  :global(body:has(.seo-page) .editorial-brand),
  :global(body:has(.seo-page) .editorial-nav__links),
  :global(body:has(.seo-page) .editorial-menu-button) { mix-blend-mode: normal; }
  .seo-page { background: var(--paper); color: var(--ink); }
  .seo-wrap { width: 100%; max-width: 1220px; margin-inline: auto; }
  .seo-page section.seo-section { padding: clamp(64px, 7vw, 104px) var(--pad-r) clamp(64px, 7vw, 104px) var(--pad-l); scroll-margin-top: 120px; }
  .seo-page section.seo-hero { padding: clamp(144px, 16vw, 200px) var(--pad-r) 80px var(--pad-l); color: var(--paper); background: var(--ink); }
  .seo-hero__grid { position: relative; display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(260px, 1fr); gap: clamp(40px, 6vw, 88px); align-items: end; }
  .seo-hero__mark { position: absolute; top: 80px; right: -20px; color: rgba(242, 239, 233, .035); font-size: clamp(140px, 25vw, 340px); line-height: 1; pointer-events: none; }
  .seo-eyebrow { margin: 0 0 22px; color: var(--verm-deep); font-family: 'ADM Semi', sans-serif; font-size: 11px; letter-spacing: .16em; line-height: 1.5; text-transform: uppercase; }
  .seo-hero .seo-eyebrow, .seo-example .seo-eyebrow { color: #ff8272; }
  h1 { max-width: 18ch; margin: 0; font-family: 'ADM Display', sans-serif; font-size: clamp(38px, 5.3vw, 76px); font-weight: 400; letter-spacing: -.04em; line-height: 1.04; }
  h2 { max-width: 21ch; margin: 0 0 28px; font-family: 'ADM Display', sans-serif; font-size: clamp(28px, 3.1vw, 44px); font-weight: 400; letter-spacing: -.03em; line-height: 1.12; }
  h3 { margin: 0; font-family: 'ADM Semi', sans-serif; font-size: clamp(20px, 2vw, 26px); line-height: 1.25; letter-spacing: -.015em; }
  .seo-copy { min-width: 0; color: #343330; font-size: 16px; line-height: 1.75; }
  .seo-copy :global(p) { margin: 0 0 20px; }
  .seo-copy :global(p:last-child) { margin-bottom: 0; }
  .seo-copy :global(a) { color: var(--verm-deep); text-decoration: underline; text-underline-offset: .2em; text-decoration-thickness: 1px; }
  .seo-copy :global(a:hover) { text-decoration-thickness: 2px; }
  .seo-copy :global(ul) { margin: 24px 0; padding-left: 20px; list-style: disc; }
  .seo-copy :global(li) { padding-left: 4px; margin: 12px 0; }
  .seo-copy :global(strong) { color: inherit; font-family: 'ADM Semi', sans-serif; }
  .seo-copy :global(code) { overflow-wrap: anywhere; font-family: ui-monospace, monospace; font-size: .85em; }
  .seo-copy :global(h4) { margin: 28px 0 16px; font-family: 'ADM Semi', sans-serif; font-size: 18px; line-height: 1.4; }
  .seo-copy :global(table) { width: 100%; table-layout: fixed; border-collapse: collapse; margin-block: 28px; font-size: 14px; line-height: 1.6; }
  .seo-copy :global(th), .seo-copy :global(td) { padding: 14px 12px; border: 1px solid var(--seo-table-border, var(--ink-faint)); text-align: left; vertical-align: top; overflow-wrap: anywhere; }
  .seo-copy :global(th) { font-family: 'ADM Semi', sans-serif; }
  .seo-hero__intro { margin-top: 30px; color: #d8d4cd; max-width: 57ch; font-size: 18px; line-height: 1.65; }
  .seo-hero__intro :global(p:last-child) { margin-top: 30px; }
  .seo-hero__intro :global(p:last-child a), .seo-contact .seo-copy :global(p:last-child a) { display: inline-flex; justify-content: center; align-items: center; min-height: 48px; padding: 14px 20px; background: var(--verm-deep); color: var(--paper); font-family: 'ADM Semi', sans-serif; font-size: 14px; line-height: 1.5; text-decoration: none; transition: background 180ms; }
  .seo-hero__intro :global(p:last-child a:hover), .seo-contact .seo-copy :global(p:last-child a:hover) { background: #921d15; }
  .seo-secondary { display: inline-flex; gap: 20px; align-items: center; min-height: 44px; margin-top: 10px; color: var(--paper); font-size: 14px; text-decoration: underline; text-underline-offset: 4px; }
  .seo-secondary span { color: #ff8272; font-size: 22px; }
  .seo-workflow { border-top: 1px solid var(--paper-faint); padding-top: 24px; }
  .seo-workflow .seo-eyebrow { margin-bottom: 12px; }
  .seo-workflow ol { margin: 0; padding: 0; list-style: none; }
  .seo-workflow li { display: flex; gap: 22px; padding: 24px 0; border-bottom: 1px solid var(--paper-faint); }
  .seo-workflow li > span { padding-top: 3px; color: #ff8272; font-family: ui-monospace, monospace; font-size: 12px; }
  .seo-workflow b { color: var(--paper); font-family: 'ADM Semi', sans-serif; font-size: 18px; }
  .seo-workflow li p { margin: 6px 0 0; color: #bdb9b1; font-size: 14px; }
  .seo-jumps { padding: 0 var(--pad-r) 0 var(--pad-l); background: #e8e4dc; border-bottom: 1px solid var(--ink-faint); }
  .seo-jumps .seo-wrap { display: flex; flex-wrap: wrap; gap: 8px 28px; align-items: center; padding-block: 12px; }
  .seo-jumps span { margin-right: auto; font-family: 'ADM Semi', sans-serif; color: #5c5953; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; }
  .seo-jumps a { display: inline-flex; align-items: center; min-height: 44px; font-size: 13px; border-bottom: 1px solid transparent; }
  .seo-jumps a:hover { color: var(--verm-deep); border-color: currentColor; }
  .seo-symptoms { border-block: 1px solid var(--ink-faint); background: #e8e4dc; }
  .seo-symptoms .seo-copy :global(ul) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; padding: 0; list-style: none; margin-block: 30px; }
  .seo-symptoms .seo-copy :global(li) { margin: 0; padding: 24px; background: var(--paper); border-left: 2px solid var(--verm-deep); font-size: 15px; }
  .seo-symptoms .seo-copy :global(p) { max-width: 82ch; }
  .seo-scope { margin-top: 44px; }
  .seo-scope__row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.65fr); gap: clamp(30px, 6vw, 90px); padding-block: 40px; border-top: 1px solid var(--ink-faint); }
  .seo-scope__row:last-child { padding-bottom: 0; }
  .seo-scope__heading { display: flex; gap: 22px; align-items: baseline; }
  .seo-number { flex-shrink: 0; color: var(--verm-deep); font-family: ui-monospace, monospace; font-size: 13px; }
  .seo-example { color: var(--paper); background: var(--ink); --seo-table-border: var(--paper-faint); }
  .seo-example h2 { max-width: 25ch; }
  .seo-example .seo-copy { max-width: 88ch; color: #d8d4cd; }
  .seo-example .seo-copy :global(a) { color: #ff8272; }
  .seo-example .seo-copy :global(pre) { padding: 26px; margin: 30px 0; background: #20201f; border: 1px solid var(--paper-faint); white-space: pre-wrap; overflow-wrap: anywhere; }
  .seo-example .seo-copy :global(pre code) { color: #ece8df; font-size: 13px; line-height: 1.85; }
  .seo-example .seo-copy :global(p:first-child) { padding: 18px 22px; border-left: 2px solid #ff8272; background: #20201f; font-size: 14px; }
  .seo-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr); gap: clamp(32px, 6vw, 88px); }
  .seo-deliverables .seo-copy :global(ul), .seo-access .seo-copy :global(ul) { padding: 0; list-style: none; }
  .seo-deliverables .seo-copy :global(li), .seo-access .seo-copy :global(li) { margin: 0; padding: 18px 0 18px 20px; border-top: 1px solid var(--ink-faint); position: relative; }
  .seo-deliverables .seo-copy :global(li::before), .seo-access .seo-copy :global(li::before) { position: absolute; left: 0; top: 27px; width: 5px; height: 5px; background: var(--verm-deep); content: ''; }
  .seo-page :global(#options), .seo-page :global(#subscribe) { scroll-margin-top: 100px; }
  .seo-page :global(#options) { border-top: 1px solid var(--ink-faint); padding-block: clamp(64px, 7vw, 104px); }
  .seo-page :global(#subscribe) { padding-top: 24px; padding-bottom: clamp(64px, 7vw, 104px); }
  .seo-page :global(#options .sec-inner), .seo-page :global(#subscribe .sec-inner) { max-width: 1220px; margin-inline: auto; }
  .seo-page :global(#options .ink-stroke), .seo-page :global(#subscribe .ink-stroke) { opacity: .04; }
  .seo-page :global(.opt-grid) { margin-top: 40px; }
  .seo-page :global(.opt) { max-width: none; }
  .seo-access { border-top: 1px solid var(--ink-faint); }
  .seo-faq { background: #e8e4dc; }
  details { border-top: 1px solid var(--ink-faint); }
  details:last-child { border-bottom: 1px solid var(--ink-faint); }
  summary { display: flex; gap: 24px; justify-content: space-between; align-items: baseline; padding-block: 24px; font-family: 'ADM Semi', sans-serif; font-size: 16px; cursor: pointer; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  summary span { flex-shrink: 0; color: var(--verm-deep); font-family: ui-monospace, monospace; font-size: 24px; line-height: 1; transition: transform 180ms; }
  details[open] summary span { transform: rotate(45deg); }
  details .seo-copy { padding-bottom: 24px; font-size: 15px; }
  @media (max-width: 1000px) {
    .seo-hero__grid { grid-template-columns: minmax(0, 1fr); }
    h1 { max-width: 22ch; font-size: clamp(38px, 7vw, 68px); }
    .seo-workflow ol { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
    .seo-workflow li { gap: 12px; }
    .seo-workflow b { font-size: 16px; }
  }
  @media (max-width: 700px) {
    .seo-page section.seo-hero { padding-top: 136px; padding-bottom: 48px; }
    .seo-page section.seo-section { padding-block: 56px; }
    .seo-hero__intro { font-size: 16px; }
    .seo-workflow ol { display: block; }
    .seo-workflow li { gap: 20px; padding-block: 18px; }
    .seo-workflow b { font-size: 17px; }
    .seo-jumps .seo-wrap { column-gap: 22px; }
    .seo-jumps span { width: 100%; padding-top: 10px; }
    .seo-symptoms .seo-copy :global(ul), .seo-scope__row, .seo-split { grid-template-columns: minmax(0, 1fr); }
    .seo-scope__row { gap: 24px; padding-block: 30px; }
    .seo-scope__heading { gap: 16px; }
    .seo-scope { margin-top: 32px; }
    .seo-example .seo-copy :global(pre) { padding: 18px; font-size: 12px; }
    .seo-example .seo-copy :global(pre code) { font-size: 12px; }
    .seo-copy :global(th), .seo-copy :global(td) { padding: 10px 8px; }
    .seo-split h2 { margin-bottom: 0; }
    .seo-page :global(#options), .seo-page :global(#subscribe) { padding-block: 56px; }
    .seo-page :global(#subscribe) { padding-top: 0; }
  }
</style>
