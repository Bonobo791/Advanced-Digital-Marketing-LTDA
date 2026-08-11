<script lang="ts">
  /**
   * Mix-and-match monthly subscription configurator (spec §3).
   *
   * pt-BR: full checkout flow — select services, enter ad spend, email, and
   * redirect to the Mercado Pago hosted subscription checkout.
   * en-US: informational state (Stripe checkout is future work) — prices shown
   * with the USD reference, no email/CTA.
   *
   * The total shown here is a client-side mirror for display only. The server
   * independently recalculates every price; a manipulated browser total can
   * never change what Mercado Pago bills.
   */
  import { untrack } from 'svelte'
  import {
    SERVICE_IDS,
    SERVICES,
    adSpendFeeBRL,
    formatPrice,
    isSubscribable,
    type ServiceId,
  } from '$lib/catalog'
  import { parseBRLInput } from '$lib/brl'
  import { EMAIL } from '$lib/constants'
  import type { Locale } from '$lib/locale'

  let {
    locale,
    preselect = [],
  }: { locale: Locale; preselect?: ServiceId[] } = $props()

  const subscribable = SERVICE_IDS.filter((id) => isSubscribable(SERVICES[id]))
  const adsIds = subscribable.filter((id) => SERVICES[id].pricing.kind === 'ads-spend')

  // Seed the selection once from the (static) preselect prop. Toggling after
  // mount is fully user-controlled; preselect never changes per page.
  let selected = $state<Set<ServiceId>>(initialSelectionFor())
  let spends = $state<Partial<Record<ServiceId, string>>>({})
  let email = $state('')
  let submitting = $state(false)
  let errorMessage = $state<string | undefined>(undefined)
  // Stable per checkout session: reused across retries so Mercado Pago's
  // X-Idempotency-Key dedupes a double-submit or a retry after a network drop.
  let idempotencyKey = $state<string | undefined>(undefined)
  let payloadFingerprint = $state('')

  const copy = {
    'en-US': {
      kicker: 'Subscribe',
      heading: 'Build your monthly package.',
      lead: 'Pick the services you want, see the monthly total, and pay through Mercado Pago. Prices are shown in USD for reference; the checkout is billed in BRL.',
      adSpendLabel: 'Monthly ad spend (R$)',
      adSpendHint: '10% of spend, $100 minimum',
      perMonth: '/mo',
      total: 'Monthly total',
      emailLabel: 'Email',
      emailPlaceholder: 'you@company.com',
      cta: 'Subscribe with Mercado Pago',
      submitting: 'Redirecting to Mercado Pago...',
      secureNote: 'You will continue in Mercado Pago\u2019s secure environment to complete the payment.',
      comingSoon: 'Subscription checkout is coming soon (Stripe). Until then, email us to start.',
      emailUs: 'Email us',
      selectOne: 'Select at least one service.',
      invalidEmail: 'Enter a valid email address.',
      invalidSpend: 'Enter a valid monthly ad spend for the ads services.',
    },
    'pt-BR': {
      kicker: 'Assine',
      heading: 'Monte seu pacote mensal.',
      lead: 'Escolha os serviços, veja o total mensal na hora e pague pelo Mercado Pago. Os valores abaixo são os mesmos cobrados no checkout.',
      adSpendLabel: 'Investimento mensal em anúncios (R$)',
      adSpendHint: '10% do investimento, mínimo de R$ 500',
      perMonth: '/mês',
      total: 'Total mensal',
      emailLabel: 'E-mail',
      emailPlaceholder: 'voce@empresa.com.br',
      cta: 'Assinar com Mercado Pago',
      submitting: 'Redirecionando para o Mercado Pago...',
      secureNote: 'Você continuará no ambiente seguro do Mercado Pago para concluir o pagamento.',
      comingSoon: 'O checkout de assinaturas está chegando em breve (Stripe). Até lá, fale com a gente por e-mail.',
      emailUs: 'Fale conosco',
      selectOne: 'Selecione ao menos um serviço.',
      invalidEmail: 'Informe um e-mail válido.',
      invalidSpend: 'Informe um valor de investimento mensal válido para os anúncios.',
    },
  } as const

  let text = $derived(copy[locale])

  /** One-time seed of the checkbox state from the static preselect prop. */
  function initialSelectionFor(): Set<ServiceId> {
    return new Set(preselect.filter((id) => isSubscribable(SERVICES[id])))
  }

  // Reseed when the route's preselect changes: in-app navigation between two
  // [slug] service pages reuses this component, so the $state initializer does
  // not run again (e.g. paid-search → meta-ads would keep paid-search checked).
  $effect(() => {
    const next = initialSelectionFor()
    untrack(() => {
      if (next.size !== selected.size || [...next].some((id) => !selected.has(id))) {
        selected = next
      }
    })
  })

  function spendOf(id: ServiceId): number {
    const value = spends[id]
    if (value === undefined) return 0
    return parseBRLInput(value) ?? 0
  }

  function priceOf(id: ServiceId): { amount: string } {
    const pricing = SERVICES[id].pricing
    if (pricing.kind === 'fixed') {
      // One currency per locale: BRL on pt-BR pages, USD on en-US pages.
      return { amount: formatPrice(locale, pricing.monthlyBRL, pricing.monthlyUSD) }
    }
    // ads-spend services show their live fee (or the minimum); the fee is
    // computed in BRL and converted for the en-US display.
    return { amount: formatPrice(locale, adSpendFeeBRL(spendOf(id))) }
  }

  let totalBRL = $derived(
    subscribable.reduce((sum, id) => {
      if (!selected.has(id)) return sum
      const pricing = SERVICES[id].pricing
      return pricing.kind === 'fixed' ? sum + pricing.monthlyBRL : sum + adSpendFeeBRL(spendOf(id))
    }, 0),
  )

  function toggle(id: ServiceId) {
    const next = new Set(selected)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    selected = next
  }

  function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
  }

  function fireBeginCheckout(items: { item_id: string; item_name: string }[], value: number) {
    if (typeof window === 'undefined') return
    const dataLayer = (window as unknown as { dataLayer?: unknown[] }).dataLayer
    if (!Array.isArray(dataLayer)) {
      console.info('[checkout] analytics: no dataLayer found; begin_checkout was not fired')
      return
    }
    dataLayer.push({ event: 'begin_checkout', currency: 'BRL', value, items })
  }

  let genericError = $derived(
    locale === 'pt-BR'
      ? 'Não foi possível iniciar o pagamento pelo Mercado Pago. Tente novamente.'
      : 'Could not start the Mercado Pago payment. Please try again.',
  )

  function errorMessageFor(code: string | undefined): string {
    switch (code) {
      case 'invalid_email':
        return text.invalidEmail
      case 'invalid_ad_spend':
        return text.invalidSpend
      case 'invalid_service':
      case 'service_unavailable':
      case 'quote_only_service':
        return locale === 'pt-BR'
          ? 'Um dos serviços selecionados não está mais disponível. Atualize a página.'
          : 'One of the selected services is no longer available. Refresh the page.'
      case 'no_services_selected':
        return text.selectOne
      case 'missing_credentials':
        return locale === 'pt-BR'
          ? 'O pagamento ainda não está configurado. Tente novamente mais tarde.'
          : 'Payments are not configured yet. Please try again later.'
      default:
        return genericError
    }
  }

  async function submit() {
    if (submitting) return
    errorMessage = undefined

    if (selected.size === 0) {
      errorMessage = text.selectOne
      return
    }
    for (const id of adsIds) {
      if (selected.has(id) && parseBRLInput(spends[id] ?? '') === undefined) {
        errorMessage = text.invalidSpend
        return
      }
    }
    if (!isValidEmail(email)) {
      errorMessage = text.invalidEmail
      return
    }

    submitting = true
    try {
      const serviceIds = subscribable.filter((id) => selected.has(id))
      const config: Record<string, { monthlyAdSpend: number }> = {}
      for (const id of adsIds) {
        if (selected.has(id)) config[id] = { monthlyAdSpend: spendOf(id) }
      }

      // Regenerate the idempotency key whenever the checkout payload changes:
      // a retry after a lost response must not bind the customer to a stale
      // package, while retrying the SAME payload reuses the key so Mercado
      // Pago's X-Idempotency-Key dedupes it.
      const fingerprint = `${email.trim()}|${serviceIds.join(',')}|${JSON.stringify(config)}`
      if (fingerprint !== payloadFingerprint) {
        idempotencyKey = crypto.randomUUID()
        payloadFingerprint = fingerprint
      }

      fireBeginCheckout(
        serviceIds.map((id) => ({ item_id: id, item_name: SERVICES[id].name[locale] })),
        totalBRL,
      )

      const response = await fetch('/api/checkout/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          serviceIds,
          config,
          idempotencyKey,
          locale,
        }),
      })

      const body = (await response.json().catch(() => ({}))) as { checkoutUrl?: unknown; error?: unknown }
      if (!response.ok) {
        errorMessage = errorMessageFor(typeof body.error === 'string' ? body.error : undefined)
        return
      }
      if (typeof body.checkoutUrl !== 'string') {
        errorMessage = genericError
        return
      }

      // Full-page redirect: the browser address bar visibly leaves our domain.
      window.location.assign(body.checkoutUrl)
    } catch {
      errorMessage = genericError
    } finally {
      submitting = false
    }
  }
</script>

<section class="paper-sec subscribe-panel" id="subscribe">
  <div class="kanji ink-stroke" style="left:-6vw;bottom:-10%" aria-hidden="true">契約</div>
  <div class="sec-inner">
    <span class="sec-jp rise">{text.kicker}<span class="font-jp">契約</span></span>
    <h2 class="shear">{text.heading}</h2>
    <p class="sec-lead rise">{text.lead}</p>

    <div class="sub-list">
      {#each subscribable as id (id)}
        {@const service = SERVICES[id]}
        {@const price = priceOf(id)}
        <div class="sub-row" class:on={selected.has(id)}>
          <label class="sub-check">
            <input
              type="checkbox"
              checked={selected.has(id)}
              onchange={() => toggle(id)}
              disabled={locale !== 'pt-BR'}
            />
            <span class="sub-name">
              <b>{service.name[locale]}</b>
              <i>{service.description[locale]}</i>
            </span>
          </label>
          <span class="sub-price">
            <b>{price.amount}</b>
          </span>
          {#if service.pricing.kind === 'ads-spend' && selected.has(id)}
            <label class="sub-spend">
              <span>{text.adSpendLabel}</span>
              <input
                type="text"
                inputmode="decimal"
                placeholder="0"
                value={spends[id] ?? ''}
                oninput={(e) => (spends[id] = (e.currentTarget as HTMLInputElement).value)}
                disabled={locale !== 'pt-BR'}
              />
              <small>{text.adSpendHint}</small>
            </label>
          {/if}
        </div>
      {/each}
    </div>

    <div class="sub-total">
      <span>{text.total}</span>
      <b>{formatPrice(locale, totalBRL)}<small>{text.perMonth}</small></b>
    </div>

    {#if locale === 'pt-BR'}
      <form class="sub-checkout" onsubmit={(e) => { e.preventDefault(); submit() }}>
        <label class="sub-email">
          <span>{text.emailLabel}</span>
          <input
            type="email"
            autocomplete="email"
            placeholder={text.emailPlaceholder}
            value={email}
            oninput={(e) => (email = (e.currentTarget as HTMLInputElement).value)}
            disabled={submitting}
          />
        </label>

        {#if errorMessage}
          <p class="sub-error" role="alert">{errorMessage}</p>
        {/if}

        <button class="btn btn-solid" type="submit" disabled={submitting}>
          {submitting ? text.submitting : text.cta}
        </button>
        <p class="sub-note">{text.secureNote}</p>
      </form>
    {:else}
      <p class="sub-note sub-coming-soon">{text.comingSoon}</p>
      <a class="btn btn-ghost-ink" href={`mailto:${EMAIL}`}>{text.emailUs}</a>
    {/if}
  </div>
</section>
