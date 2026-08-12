<script lang="ts">
  import { getContext, onMount } from 'svelte'
  import type { PageProps } from './$types'
  import { SITE_MOTION, type SiteMotion } from '$lib/client/site-motion'
  import { setupReveals } from '$lib/client/reveal'
  import { absoluteUrl, LOCALE_ROUTES } from '$lib/locale'

  const motion = getContext<SiteMotion>(SITE_MOTION)

  let { data }: PageProps = $props()

  onMount(() => {
    motion.registerHero()
    return setupReveals()
  })

  // Subject + headline read as one sentence: "Sua assinatura foi processada."
  // (subscriptions) or "Seu pagamento foi aprovado." (one-time builds).
  const subject = $derived(data.state === 'payment_confirmed' || data.state === 'payment_unconfirmed' ? 'Seu pagamento' : 'Sua assinatura')

  const headline = $derived(
    data.state === 'confirmed'
      ? 'foi processada.'
      : data.state === 'payment_confirmed'
        ? 'foi aprovado.'
        : data.state === 'pending'
          ? 'está sendo processada.'
          : data.state === 'payment_unconfirmed'
            ? 'não foi concluído.'
            : data.state === 'cancelled'
              ? 'não está mais ativa.'
              : data.state === 'rate_limited'
                ? 'não pôde ser confirmado agora.'
                : 'não pôde ser confirmado.',
  )

  const subtext = $derived(
    data.state === 'confirmed'
      ? 'Sua assinatura foi processada pelo Mercado Pago. Você receberá os detalhes da assinatura e do pagamento pelo Mercado Pago.'
      : data.state === 'payment_confirmed'
        ? 'Seu pagamento foi aprovado pelo Mercado Pago. Vamos começar o desenvolvimento do seu site — você receberá os próximos passos por e-mail.'
        : data.state === 'pending'
          ? 'Estamos processando sua assinatura. A confirmação pode levar alguns minutos — você receberá os detalhes por e-mail.'
          : data.state === 'payment_unconfirmed'
            ? 'Seu pagamento não foi confirmado pelo Mercado Pago. Se você tentou pagar e foi redirecionado, tente novamente pelo site ou entre em contato conosco.'
            : data.state === 'cancelled'
              ? 'Sua assinatura está pausada ou cancelada. Para retomá-la ou tirar dúvidas, entre em contato pelo e-mail de confirmação do Mercado Pago.'
              : data.state === 'rate_limited'
                ? 'Muitas tentativas de verificação em pouco tempo. Aguarde alguns minutos e abra o link novamente.'
                : 'Não foi possível confirmar seu pagamento. Verifique o link usado ou tente novamente pelo site.',
  )

  const referenceLabel = $derived(
    data.state === 'confirmed'
      ? 'Referência da assinatura'
      : data.state === 'payment_confirmed'
        ? 'Referência do pagamento'
        : undefined,
  )

  const referenceValue = $derived(
    data.state === 'confirmed'
      ? data.subscriptionId
      : data.state === 'payment_confirmed'
        ? data.paymentId
        : undefined,
  )
</script>

<svelte:head>
  <title>
    {data.state === 'confirmed' || data.state === 'payment_confirmed' ? 'Pagamento concluído' : 'Pagamento'} | Advanced Digital Marketing LTDA
  </title>
  <meta
    name="description"
    content="Acompanhe o status do seu pagamento após o checkout com o Mercado Pago."
  />
  <link rel="canonical" href={absoluteUrl('/pt-br/checkout/complete/')} />
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="index-home service-page">
  <section class="hero index-hero" class:hero-revealed={motion.state.hero === 'revealed'}>
    <div class="sec-inner hero-inner">
      <div class="hero-kick">
        <span class="jp" data-hero-reveal style="--hero-delay:0ms">「契約」</span>
        <span class="en" data-hero-reveal style="--hero-delay:60ms">Pagamento</span>
      </div>
      <p class="hero-line1" data-hero-reveal style="--hero-delay:120ms">Obrigado<b>.</b></p>
      <h1 class="hero-h1">
        <span class="h-mask"><span class="h-line" data-hero-reveal style="--hero-delay:180ms">{subject}</span></span>
        <span class="h-mask"><span class="h-line" data-hero-reveal style="--hero-delay:270ms"><em>{headline}</em></span></span>
      </h1>
      <div class="hero-row">
        <p class="hero-sub" data-hero-reveal style="--hero-delay:440ms">
          {subtext}
        </p>
        {#if referenceLabel && referenceValue}
          <p class="hero-sub" data-hero-reveal style="--hero-delay:480ms">
            {referenceLabel}: {referenceValue}
          </p>
        {/if}
      </div>
      <div class="cta-row" data-hero-reveal style="--hero-delay:520ms">
        <a class="btn btn-solid" href={LOCALE_ROUTES.home['pt-BR']}>Voltar ao início</a>
      </div>
    </div>
  </section>
</div>
