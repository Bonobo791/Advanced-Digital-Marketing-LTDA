<script lang="ts">
  import Kanji from '$lib/components/chrome/Kanji.svelte'
  import MotionHeading from '$lib/components/chrome/MotionHeading.svelte'
  import { EMAIL, PORTUGUESE_EMAIL } from '$lib/constants'
  import { formatBRL } from '$lib/format'
  import type { Locale } from '$lib/locale'
  import type { PricedProduct } from '$lib/server/pricing'

  let { locale, products }: { locale: Locale; products: PricedProduct[] } = $props()

  const copy = $derived(
    {
      'en-US': {
        label: 'Pricing',
        labelJp: '料金',
        heading: 'Fixed scope. Fixed price.',
        sub: 'One-time projects with clear pricing. Contact us to get started — we reply within one business day.',
        cta: 'Contact us',
        perMonth: '/month',
        unavailable: 'Pricing is temporarily unavailable. Please try again in a moment.',
        footnote: 'Prices are fixed in BRL. Custom scopes are quoted on request.',
      },
      'pt-BR': {
        label: 'Preços',
        labelJp: '料金',
        heading: 'Escopo fechado. Preço fechado.',
        sub: 'Projetos pontuais com preço fechado. Fale conosco para começar — respondemos em até um dia útil.',
        cta: 'Fale conosco',
        perMonth: '/mês',
        unavailable: 'Os preços estão temporariamente indisponíveis. Tente novamente em instantes.',
        footnote: 'Preços fixos em reais. Escopos sob medida são orçados sob consulta.',
      },
    }[locale],
  )

  const contactHref = (productName: string) =>
    `mailto:${locale === 'pt-BR' ? PORTUGUESE_EMAIL : EMAIL}?subject=${encodeURIComponent(productName)}`
</script>

<section class="editorial-subhero">
  <Kanji char="料" class="subhero-kanji" />
  <div class="subhero-grid">
    <div class="subhero-copy">
      <p class="section-label motion-rise"><span class="font-jp">{copy.labelJp}</span> {copy.label}</p>
      <h1 class="motion-subhero-heading"><span>{copy.heading}</span></h1>
      <p class="motion-rise">{copy.sub}</p>
    </div>
  </div>
</section>

<section class="editorial-section editorial-section--paper pricing-section">
  <div class="section-inner">
    {#if products.length === 0}
      <p class="pricing-unavailable">{copy.unavailable}</p>
    {:else}
      <div class="pricing-grid">
        {#each products as product (product.slug)}
          <article class="pricing-card motion-rise">
            <h3>{product.name}</h3>
            <p class="pricing-desc">{product.description}</p>
            <div class="pricing-price">
              {formatBRL(product.price.amountCents)}
              {#if product.price.billingType === 'recurring'}<span class="pricing-per">{copy.perMonth}</span>{/if}
            </div>
            <a class="pricing-cta" href={contactHref(product.name)}>{copy.cta}<span aria-hidden="true"> →</span></a>
          </article>
        {/each}
      </div>
      <p class="pricing-footnote">{copy.footnote}</p>
    {/if}
  </div>
</section>

<style>
  .pricing-section { padding-block: 5rem; }
  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1.25rem;
  }
  .pricing-card {
    background: var(--paper);
    border: 1px solid var(--ink-faint);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .pricing-card h3 { margin: 0; font-size: 1.15rem; letter-spacing: 0.01em; }
  .pricing-desc { margin: 0; color: var(--ink-muted); font-size: 0.95rem; }
  .pricing-price { font-size: 2rem; font-weight: 700; letter-spacing: -0.02em; }
  .pricing-per { font-size: 1rem; color: var(--ink-muted); font-weight: 500; }
  .pricing-cta {
    align-self: flex-start;
    margin-top: auto;
    background: var(--ink);
    color: var(--paper);
    padding: 0.65rem 1.1rem;
    text-decoration: none;
    border: 1px solid var(--ink);
    transition: background 0.2s var(--ease-out), border-color 0.2s var(--ease-out);
  }
  .pricing-cta:hover { background: var(--verm); border-color: var(--verm); }
  .pricing-unavailable { color: var(--ink-muted); }
  .pricing-footnote { margin-top: 2rem; color: var(--ink-muted); font-size: 0.9rem; }
</style>
