<script lang="ts">
  import { onMount } from 'svelte'
  import { formatBRL } from '$lib/format'
  import type { Locale } from '$lib/locale'
  import { fetchOrder, pollOrder, type PublicOrder } from '$lib/orderStatus'

  export type ResultVariant = 'success' | 'pending' | 'failure'

  let { locale, variant }: { locale: Locale; variant: ResultVariant } = $props()

  const copy = $derived({
    'en-US': {
      successTitle: 'Pagamento confirmado',
      successTitleEN: 'Payment confirmed',
      pendingTitle: 'Payment pending',
      failureTitle: 'Payment not completed',
      awaiting: 'We are waiting for Mercado Pago to confirm your payment. This page updates automatically.',
      checking: 'Checking your payment status…',
      notFound: 'We could not find this order. If you already paid, the confirmation email will still arrive.',
      tryAgain: 'Try again',
      back: '← Back to pricing',
      orderRef: 'Order',
      amount: 'Amount',
    },
    'pt-BR': {
      successTitle: 'Pagamento confirmado',
      successTitleEN: 'Pagamento confirmado',
      pendingTitle: 'Pagamento pendente',
      failureTitle: 'Pagamento não concluído',
      awaiting: 'Aguardamos a confirmação do Mercado Pago. Esta página atualiza sozinha.',
      checking: 'Verificando o status do seu pagamento…',
      notFound: 'Não encontramos este pedido. Se você já pagou, a confirmação chegará por e-mail.',
      tryAgain: 'Tentar novamente',
      back: '← Voltar aos preços',
      orderRef: 'Pedido',
      amount: 'Valor',
    },
  }[locale],
  )

  const pricingHref = $derived(locale === 'pt-BR' ? '/pt-br/precos/' : '/pricing/')

  let order = $state<PublicOrder | null>(null)
  let loading = $state(true)
  let stopPoll: (() => void) | undefined
  const tryAgainHref = $derived(
    typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : pricingHref,
  )

  const isTerminal = (status: string | undefined) =>
    status === 'approved' || status === 'rejected' || status === 'refunded'

  onMount(() => {
    const orderId = new URLSearchParams(window.location.search).get('order_id')
    if (!orderId) {
      loading = false
      return
    }

    if (variant === 'success' || variant === 'pending') {
      void fetchOrder(orderId).then((initial) => {
        order = initial
        loading = false
        if (!initial || !isTerminal(initial.status)) {
          stopPoll = pollOrder(orderId, (updated) => {
            order = updated
          })
        }
      })
    } else {
      void fetchOrder(orderId).then((initial) => {
        order = initial
        loading = false
      })
    }

    return () => stopPoll?.()
  })
</script>

<section class="result-page">
  <div class="result-inner">
    {#if variant === 'failure' || (order && (order.status === 'rejected' || order.status === 'refunded')) || (!loading && !order)}
      <p class="section-label"><span class="font-jp">結果</span> {copy.failureTitle}</p>
      <h1 class="result-heading">{copy.failureTitle}</h1>
      <p class="result-copy">{copy.notFound}</p>
      <div class="result-actions">
        <a class="result-cta" href={pricingHref}>{copy.back}</a>
        <a class="result-cta result-cta--ghost" href={tryAgainHref}>{copy.tryAgain}</a>
      </div>
    {:else if order && order.status === 'approved'}
      <p class="section-label"><span class="font-jp">完了</span> {copy.successTitleEN}</p>
      <h1 class="result-heading">{copy.successTitle}</h1>
      <dl class="result-facts">
        <div><dt>{copy.orderRef}</dt><dd>{order.id.slice(0, 8)}</dd></div>
        <div><dt>{order.productName}</dt><dd>{formatBRL(order.amountCents)}</dd></div>
      </dl>
      <a class="result-cta" href={pricingHref}>{copy.back}</a>
    {:else}
      <p class="section-label"><span class="font-jp">保留</span> {copy.pendingTitle}</p>
      <h1 class="result-heading">{copy.pendingTitle}</h1>
      <p class="result-copy">{loading ? copy.checking : copy.awaiting}</p>
      <a class="result-cta result-cta--ghost" href={pricingHref}>{copy.back}</a>
    {/if}
  </div>
</section>

<style>
  .result-page { padding-block: 6rem; }
  .result-inner { max-width: 720px; margin-inline: auto; padding-inline: 1.5rem; }
  .result-heading { font-size: clamp(2rem, 6vw, 3.2rem); line-height: 1.02; margin: 0.5rem 0 1.25rem; }
  .result-copy { color: var(--paper-muted); max-width: 46ch; }
  .result-facts { margin: 2rem 0; }
  .result-facts > div { display: flex; justify-content: space-between; gap: 1rem; padding-block: 0.6rem; border-top: 1px solid var(--paper-faint); }
  .result-facts dt { color: var(--paper-muted); }
  .result-actions { display: flex; gap: 1rem; flex-wrap: wrap; }
  .result-cta {
    display: inline-block;
    background: var(--verm);
    color: var(--paper);
    padding: 0.7rem 1.2rem;
    text-decoration: none;
    border: 1px solid var(--verm);
  }
  .result-cta--ghost { background: transparent; color: var(--paper); border-color: var(--paper-faint); }
</style>
