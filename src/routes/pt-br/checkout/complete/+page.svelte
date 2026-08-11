<script lang="ts">
  import { absoluteUrl, LOCALE_ROUTES } from '$lib/locale'
</script>

<svelte:head>
  <title>Assinatura concluída | Advanced Digital Marketing LTDA</title>
  <meta
    name="description"
    content="Sua assinatura foi processada pelo Mercado Pago. Você receberá os detalhes da assinatura e do pagamento pelo Mercado Pago."
  />
  <link rel="canonical" href={absoluteUrl('/pt-br/checkout/complete/')} />
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="index-home service-page">
  <section class="hero index-hero">
    <div class="sec-inner hero-inner">
      <div class="hero-kick">
        <span class="jp" data-hero-reveal style="--hero-delay:0ms">「契約」</span>
        <span class="en" data-hero-reveal style="--hero-delay:60ms">Assinatura</span>
      </div>
      <p class="hero-line1" data-hero-reveal style="--hero-delay:120ms">Obrigado<b>.</b></p>
      <h1 class="hero-h1">
        <span class="h-mask"><span class="h-line" data-hero-reveal style="--hero-delay:180ms">Sua assinatura</span></span>
        <span class="h-mask"><span class="h-line" data-hero-reveal style="--hero-delay:270ms"><em>foi processada.</em></span></span>
      </h1>
      <div class="hero-row">
        <p class="hero-sub" data-hero-reveal style="--hero-delay:440ms">
          Sua assinatura foi processada pelo Mercado Pago. Você receberá os detalhes da assinatura e do
          pagamento pelo Mercado Pago.
        </p>
      </div>
      <div class="cta-row" data-hero-reveal style="--hero-delay:520ms">
        <a class="btn btn-solid" href={LOCALE_ROUTES.home['pt-BR']}>Voltar ao início</a>
      </div>
    </div>
  </section>
</div>
