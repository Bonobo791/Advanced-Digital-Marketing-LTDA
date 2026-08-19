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
   * en-US: "Buy this website" starts a one-time Stripe Checkout payment
   * (server-priced in USD; activated by STRIPE_SECRET_KEY — see
   * docs/stripe-checkout.md).
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
  import type { Locale } from '$lib/locale'
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
      hostingNote: 'Then add hosting as your monthly charge below — maintenance and site changes included.',
      submitting: 'Opening Stripe...',
      genericError: 'Could not start the Stripe payment. Please try again.',
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
  // One idempotency key per selected build (type:kind), reused across retries:
  // if the server created the checkout but the response was lost, retrying the
  // SAME build must reuse the key so Stripe/MP dedupes instead of creating a
  // second payable checkout. A new selection generates a new key.
  let idempotencyKey = $state<string | undefined>(undefined)
  let keySelection = $state('')

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
        // pt-BR: the display price IS the billed BRL amount. en-US: the USD
        // display price is the billed amount too (Stripe).
        websiteBuildPrice(locale, type, kind),
        locale === 'en-US' ? 'USD' : 'BRL',
      )

      // pt-BR bills BRL through Mercado Pago; en-US bills USD through Stripe.
      const endpoint = locale === 'en-US' ? '/api/checkout/stripe' : '/api/checkout/build'
      const selection = `${type}:${kind}`
      if (selection !== keySelection) {
        idempotencyKey = crypto.randomUUID()
        keySelection = selection
      }
      const result = await fetchCheckoutUrl(endpoint, {
        flow: 'build',
        type,
        kind,
        // Reused for the same selection (see above) so a retry after a lost
        // response never creates a second payable checkout.
        idempotencyKey: idempotencyKey ?? crypto.randomUUID(),
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
        <button class="btn btn-solid" type="button" onclick={buy} disabled={submitting}>
          {submitting ? text.submitting : text.buyCta}
        </button>
        {#if errorMessage}
          <p class="sub-error" role="alert">{errorMessage}</p>
        {/if}
        <p class="build-note">{text.hostingNote}</p>
      </div>
    </div>
  </div>
</section>
