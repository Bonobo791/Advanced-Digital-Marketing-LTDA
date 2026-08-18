<script lang="ts">
  /**
   * One-time website build pricing + purchase (user-defined spec).
   *
   * A single pricing line with two flippers:
   *  - build type: Website Development / Ecommerce Website Development
   *  - project kind: New website / Migration (migration costs 2×)
   *
   * pt-BR: "Comprar site" starts a one-time Mercado Pago Checkout Pro payment
   * for the selected build (server-priced in BRL). The monthly hosting
   * subscription — maintenance + site changes — stays in the SubscribeSection
   * right below, preselected as the recurring monthly charge.
   * en-US: informational state (Stripe checkout is future work) — prices shown
   * with the USD reference, purchase by email.
   */
  import {
    WEBSITE_BUILD_KINDS,
    WEBSITE_BUILD_NAMES,
    WEBSITE_BUILD_TYPES,
    formatBuildPrice,
    websiteBuildPrice,
    type WebsiteBuildKind,
    type WebsiteBuildType,
  } from '$lib/website-builds'
  import { LOCALE_ROUTES, type Locale } from '$lib/locale'
  import { words } from '$lib/text'
  import { fetchCheckoutUrl } from '$lib/client/checkout'
  import { fireBeginCheckout } from '$lib/client/analytics'

  let { locale }: { locale: Locale } = $props()

  const copy = {
    'en-US': {
      kicker: 'Websites',
      heading: 'One-time website builds.',
      lead: 'A fixed price for a complete build. Choose the type, then whether we are migrating an existing site or building from scratch — migrations are priced at 2\u00D7.',
      typeLabel: 'Type',
      types: { website: 'Website', ecommerce: 'Ecommerce' },
      kindLabel: 'Project',
      kinds: { new: 'New website', migration: 'Migration' },
      oneTime: 'one-time',
      migrationNote: 'migration \u00B7 2\u00D7',
      buyCta: 'Buy this website',
      comingSoon: 'One-time checkout is coming soon (Stripe). Until then, email us to start your build.',
      emailCta: 'Email us to start a build',
      hostingNote: 'Then add hosting as your monthly charge below — maintenance and site changes included.',
      submitting: 'Opening Mercado Pago...',
      genericError: 'Could not start the Mercado Pago payment. Please try again.',
      missingCredentials: 'Payments are not configured yet. Please try again later.',
      rateLimited: 'Too many attempts. Please try again in a few minutes.',
      invalidBuild: 'Invalid build selection. Refresh the page.',
    },
    'pt-BR': {
      kicker: 'Sites',
      heading: 'Sites com preço fechado.',
      lead: 'Preço único para o build completo. Escolha o tipo e se é um site novo ou migração de um site existente — migrações custam 2\u00D7.',
      typeLabel: 'Tipo',
      types: { website: 'Site', ecommerce: 'E-commerce' },
      kindLabel: 'Projeto',
      kinds: { new: 'Site novo', migration: 'Migração' },
      oneTime: 'pagamento único',
      migrationNote: 'migração \u00B7 2\u00D7',
      buyCta: 'Comprar site',
      comingSoon: '',
      emailCta: '',
      hostingNote: 'Depois de comprar o site, adicione a hospedagem como cobrança mensal abaixo — manutenção e alterações incluídas.',
      submitting: 'Abrindo o Mercado Pago...',
      genericError: 'Não foi possível iniciar o pagamento pelo Mercado Pago. Tente novamente.',
      missingCredentials: 'O pagamento ainda não está configurado. Tente novamente mais tarde.',
      rateLimited: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
      invalidBuild: 'Seleção inválida. Atualize a página.',
    },
  } as const

  let text = $derived(copy[locale])
  let type = $state<WebsiteBuildType>('website')
  let kind = $state<WebsiteBuildKind>('new')
  let price = $derived(websiteBuildPrice(locale, type, kind))
  let submitting = $state(false)
  let errorMessage = $state<string | undefined>(undefined)

  function errorMessageFor(code: string | undefined): string {
    switch (code) {
      case 'invalid_build':
        return text.invalidBuild
      case 'missing_credentials':
        return text.missingCredentials
      case 'rate_limited':
        return text.rateLimited
      default:
        return text.genericError
    }
  }

  async function buy() {
    if (submitting) return
    errorMessage = undefined
    submitting = true
    try {
      fireBeginCheckout(
        [
          {
            item_id: `website-build:${type}:${kind}`,
            item_name: WEBSITE_BUILD_NAMES[locale][type],
          },
        ],
        // The pt-BR display price IS the billed BRL amount (the only checkout
        // currency); en-US never reaches this code path.
        websiteBuildPrice('pt-BR', type, kind),
      )

      const result = await fetchCheckoutUrl('/api/checkout/build', {
        type,
        kind,
        // Fresh per click: Checkout Pro preferences are charged once when the
        // customer pays, so retrying a lost response must never reuse a stale
        // preference reference.
        idempotencyKey: crypto.randomUUID(),
        locale,
      })
      if (!result.ok) {
        errorMessage = errorMessageFor(result.errorCode)
        return
      }

      // Full-page redirect: the browser address bar visibly leaves our domain.
      window.location.assign(result.checkoutUrl)
    } catch (error) {
      // Fail loudly on the client log; keep the generic message user-facing.
      console.error('[checkout] build purchase failed', error)
      errorMessage = text.genericError
    } finally {
      submitting = false
    }
  }
</script>

<section class="paper-sec build-panel" id="builds">
  <div class="kanji ink-stroke" style="left:-6vw;bottom:-10%" aria-hidden="true">作</div>
  <div class="sec-inner">
    <span class="sec-jp rise">{text.kicker}<span class="font-jp">作</span></span>
    <h2 class="shear">{#each words(text.heading) as word, i}<span class="w">{word}{i < words(text.heading).length - 1 ? ' ' : ''}</span>{/each}</h2>
    <p class="sec-lead rise">{text.lead}</p>

    <div class="sub-row build-row">
      <div class="build-info">
        <b class="build-name">{WEBSITE_BUILD_NAMES[locale][type]}</b>
        <div class="build-flips">
          <div class="flip-group">
            <span class="flip-label">{text.typeLabel}</span>
            <div class="flip" role="group" aria-label={text.typeLabel}>
              {#each WEBSITE_BUILD_TYPES as t (t)}
                <button type="button" aria-pressed={type === t} onclick={() => (type = t)} disabled={submitting}>{text.types[t]}</button>
              {/each}
            </div>
          </div>
          <div class="flip-group">
            <span class="flip-label">{text.kindLabel}</span>
            <div class="flip" role="group" aria-label={text.kindLabel}>
              {#each WEBSITE_BUILD_KINDS as k (k)}
                <button type="button" aria-pressed={kind === k} onclick={() => (kind = k)} disabled={submitting}>{text.kinds[k]}</button>
              {/each}
            </div>
          </div>
        </div>
      </div>
      <div class="sub-price build-price" aria-live="polite">
        <b>{formatBuildPrice(locale, price)}</b>
        <small>{kind === 'migration' ? text.migrationNote : text.oneTime}</small>
      </div>
      <div class="build-cta">
        {#if locale === 'pt-BR'}
          <button class="btn btn-solid" type="button" onclick={buy} disabled={submitting}>
            {submitting ? text.submitting : text.buyCta}
          </button>
          {#if errorMessage}
            <p class="sub-error" role="alert">{errorMessage}</p>
          {/if}
          <p class="build-note">{text.hostingNote}</p>
        {:else}
          <p class="sub-note sub-coming-soon">{text.comingSoon}</p>
          <a class="btn btn-ghost-ink" href={LOCALE_ROUTES.contact[locale]}>{text.emailCta}</a>
          <p class="build-note">{text.hostingNote}</p>
        {/if}
      </div>
    </div>
  </div>
</section>
