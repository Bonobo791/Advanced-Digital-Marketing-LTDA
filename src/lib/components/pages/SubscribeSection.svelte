<script lang="ts">
  /**
   * Mix-and-match monthly subscription configurator (spec §3).
   *
   * pt-BR: full checkout flow — select services, enter ad spend (R$), email,
   * and redirect to the Mercado Pago hosted subscription checkout (BRL).
   * en-US: full checkout flow too — ad spend in US$, billed by Stripe
   * Checkout in USD (activated by STRIPE_SECRET_KEY; see
   * docs/stripe-checkout.md).
   *
   * The total shown here is a client-side mirror for display only. The server
   * independently recalculates every price; a manipulated browser total can
   * never change what Mercado Pago bills.
   */
  import { untrack } from 'svelte'
  import {
    CATALOG_SERVICE_IDS,
    SERVICES,
    adSpendFeeBRL,
    adSpendFeeUSD,
    formatPrice,
    formatUSD,
    isSubscribable,
    type CatalogServiceId,
  } from '$lib/catalog'
  import { parseBRLInput } from '$lib/brl'
  import { BRL_USD_REFERENCE_RATE } from '$lib/catalog'
  import { parseUSDInput } from '$lib/usd'
  import { fireBeginCheckout } from '$lib/client/analytics'
  import { fetchCheckoutUrl } from '$lib/client/checkout'
  import type { Locale } from '$lib/locale'

  let {
    locale,
    preselect = [],
  }: { locale: Locale; preselect?: CatalogServiceId[] } = $props()

  const subscribable = CATALOG_SERVICE_IDS.filter((id) => isSubscribable(SERVICES[id]))
  const adsIds = subscribable.filter((id) => SERVICES[id].pricing.kind === 'ads-spend')

  // Seed the selection once from the (static) preselect prop. Toggling after
  // mount is fully user-controlled; preselect never changes per page.
  let selected = $state<Set<CatalogServiceId>>(initialSelectionFor())
  let spends = $state<Partial<Record<CatalogServiceId, string>>>({})
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
      lead: 'Pick the services you want and watch the monthly total update as you go. You will complete the payment on Stripe in USD.',
      adSpendLabel: 'Monthly ad spend (US$)',
      adSpendHint: '10% of spend, $100 minimum',
      perMonth: '/mo',
      total: 'Monthly total',
      emailLabel: 'Email',
      emailPlaceholder: 'you@company.com',
      cta: 'Subscribe with Stripe',
      submitting: 'Redirecting to Stripe...',
      secureNote: 'You will continue in Stripe\u2019s secure environment to complete the payment.',
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
      selectOne: 'Selecione ao menos um serviço.',
      invalidEmail: 'Informe um e-mail válido.',
      invalidSpend: 'Informe um valor de investimento mensal válido para os anúncios.',
    },
  } as const

  let text = $derived(copy[locale])

  /** One-time seed of the checkbox state from the static preselect prop. */
  function initialSelectionFor(): Set<CatalogServiceId> {
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
        // Drop ad-spend inputs from the previous service page — they describe
        // a package the visitor no longer has selected, and reusing them would
        // quote a stale amount. A fresh payload also needs a fresh idempotency
        // key (payloadFingerprint mismatch regenerates it on submit).
        spends = {}
        errorMessage = undefined
        payloadFingerprint = ''
      }
    })
  })

  /** Parses an ad-spend input with the locale's separator conventions — the
   *  SAME parser must validate and price, or a valid USD entry like
   *  "1,000.50" would fail validation while a BRL-shaped "1.000,50" would
   *  silently price as 0. */
  function parseSpend(value: string): number | undefined {
    return locale === 'en-US' ? parseUSDInput(value) : parseBRLInput(value)
  }

  function spendOf(id: CatalogServiceId): number {
    const value = spends[id]
    if (value === undefined) return 0
    return parseSpend(value) ?? 0
  }

  function priceOf(id: CatalogServiceId): { amount: string } {
    const pricing = SERVICES[id].pricing
    if (pricing.kind === 'fixed') {
      // One currency per locale: BRL on pt-BR pages, USD on en-US pages.
      return { amount: formatPrice(locale, pricing.monthlyBRL, pricing.monthlyUSD) }
    }
    // ads-spend services show their live fee (or the minimum) in the
    // checkout currency: BRL fee on pt-BR, USD fee on en-US.
    return locale === 'en-US'
      ? { amount: formatUSD(adSpendFeeUSD(spendOf(id))) }
      : { amount: formatPrice(locale, adSpendFeeBRL(spendOf(id))) }
  }

  // Client-side display total in the checkout currency (BRL pt-BR / USD
  // en-US). The server independently reprices everything; this is display only.
  let totalAmount = $derived(
    subscribable.reduce((sum, id) => {
      if (!selected.has(id)) return sum
      const pricing = SERVICES[id].pricing
      if (pricing.kind === 'fixed') {
        return locale === 'en-US'
          ? sum + (pricing.monthlyUSD ?? pricing.monthlyBRL / BRL_USD_REFERENCE_RATE)
          : sum + pricing.monthlyBRL
      }
      return locale === 'en-US' ? sum + adSpendFeeUSD(spendOf(id)) : sum + adSpendFeeBRL(spendOf(id))
    }, 0),
  )

  function toggle(id: CatalogServiceId) {
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

  let genericError = $derived(
    locale === 'pt-BR'
      ? 'Não foi possível iniciar o pagamento pelo Mercado Pago. Tente novamente.'
      : 'Could not start the Stripe payment. Please try again.',
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
      case 'client_address_unavailable':
        return locale === 'pt-BR'
          ? 'Não foi possível identificar sua conexão. Tente novamente mais tarde.'
          : 'Could not identify your connection. Please try again later.'
      case 'rate_limited':
        return locale === 'pt-BR'
          ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
          : 'Too many attempts. Please try again in a few minutes.'
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
      if (selected.has(id) && parseSpend(spends[id] ?? '') === undefined) {
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
        totalAmount,
        locale === 'en-US' ? 'USD' : 'BRL',
      )

      // pt-BR bills BRL through Mercado Pago; en-US bills USD through Stripe.
      const endpoint = locale === 'en-US' ? '/api/checkout/stripe' : '/api/checkout/subscription'
      const result = await fetchCheckoutUrl(endpoint, {
        flow: 'subscription',
        email: email.trim(),
        serviceIds,
        config,
        idempotencyKey,
        locale,
      })
      if (!result.ok) {
        errorMessage = errorMessageFor(result.errorCode)
        return
      }

      // Full-page redirect: the browser address bar visibly leaves our domain.
      window.location.assign(result.checkoutUrl)
    } catch (error) {
      // Fail loudly on the server log; keep the generic message user-facing.
      console.error('[checkout] subscription preparation failed', error)
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
            <!-- Selection is a display-only calculator on every locale (the
                 checkout form itself only renders on pt-BR); disabling it on
                 en-US made the ad-spend total impossible to explore there. -->
            <input
              type="checkbox"
              checked={selected.has(id)}
              onchange={() => toggle(id)}
              disabled={submitting}
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
                disabled={submitting}
              />
              <small>{text.adSpendHint}</small>
            </label>
          {/if}
        </div>
      {/each}
    </div>

    <div class="sub-total" aria-live="polite" aria-atomic="true">
      <span>{text.total}</span>
      <b>{locale === 'en-US' ? formatUSD(totalAmount) : formatPrice(locale, totalAmount)}<small>{text.perMonth}</small></b>
    </div>

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
  </div>
</section>
