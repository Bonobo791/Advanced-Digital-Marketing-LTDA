<script lang="ts">
  import Kanji from '$lib/components/chrome/Kanji.svelte'
  import MotionHeading from '$lib/components/chrome/MotionHeading.svelte'
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
        sub: 'One-time projects paid online via Mercado Pago — Pix, card or boleto. Monthly retainers are quoted separately.',
        start: 'Pay and start',
        unavailable: 'Pricing is temporarily unavailable. Please try again in a moment.',
        footnote: 'Payment is processed by Mercado Pago. Your project starts once the payment is confirmed.',
      },
      'pt-BR': {
        label: 'Preços',
        labelJp: '料金',
        heading: 'Escopo fechado. Preço fechado.',
        sub: 'Projetos pontuais pagos online pelo Mercado Pago — Pix, cartão ou boleto. Retenções mensais são orçadas separadamente.',
        start: 'Pagar e começar',
        unavailable: 'Os preços estão temporariamente indisponíveis. Tente novamente em instantes.',
        footnote: 'O pagamento é processado pelo Mercado Pago. O projeto começa após a confirmação do pagamento.',
      },
    }[locale],
  )

  const checkoutHref = (slug: string) =>
    locale === 'pt-BR' ? `/pt-br/checkout/?product=${slug}` : `/checkout/?product=${slug}`
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
            <div class="pricing-price">{formatBRL(product.price.amountCents)}</div>
            <a class="pricing-cta" href={checkoutHref(product.slug)}>{copy.start}<span aria-hidden="true"> →</span></a>
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
