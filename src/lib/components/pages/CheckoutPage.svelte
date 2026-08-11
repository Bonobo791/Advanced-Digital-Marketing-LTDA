<script lang="ts">
  import { readStoredAttribution } from '$lib/attribution'
  import { formatBRL } from '$lib/format'
  import type { Locale } from '$lib/locale'
  import type { CheckoutPrice } from '$lib/server/pricing'

  let { locale, productSlug, price }: { locale: Locale; productSlug: string; price: CheckoutPrice | null } = $props()

  const copy = $derived({
    'en-US': {
      label: 'Checkout',
      labelJp: '会計',
      back: '← Back to pricing',
      heading: 'Project details',
      summary: 'Order summary',
      name: 'Full name',
      namePh: 'Jane Doe',
      email: 'Email',
      emailPh: 'jane@company.com',
      company: 'Company (optional)',
      companyPh: 'Acme Inc.',
      document: 'CPF / CNPJ',
      documentPh: 'CPF or CNPJ number',
      documentHint: 'Required by Mercado Pago for card and Pix payments in Brazil.',
      terms: 'I agree to the terms of service and privacy policy.',
      pay: 'Continue to payment',
      paying: 'Creating your order…',
      unavailable: 'This product is not available right now.',
      serverErrors: {
        unknown_product: 'Unknown product.',
        invalid_name: 'Please enter your name.',
        invalid_email: 'Please enter a valid email.',
        invalid_document: 'Please enter a valid CPF or CNPJ.',
        product_not_available: 'This product is not available right now.',
        payment_not_configured: 'Online payment is not configured yet.',
        database_not_configured: 'Online payment is not configured yet.',
        default: 'Something went wrong. Please try again.',
      },
      mpNote: 'You will be redirected to Mercado Pago to complete the payment with Pix, card or boleto.',
    },
    'pt-BR': {
      label: 'Checkout',
      labelJp: '会計',
      back: '← Voltar aos preços',
      heading: 'Dados do projeto',
      summary: 'Resumo do pedido',
      name: 'Nome completo',
      namePh: 'Maria da Silva',
      email: 'E-mail',
      emailPh: 'maria@empresa.com.br',
      company: 'Empresa (opcional)',
      companyPh: 'Empresa Ltda.',
      document: 'CPF / CNPJ',
      documentPh: 'Número do CPF ou CNPJ',
      documentHint: 'Exigido pelo Mercado Pago para pagamento com cartão e Pix no Brasil.',
      terms: 'Concordo com os termos de serviço e a política de privacidade.',
      pay: 'Continuar para o pagamento',
      paying: 'Criando seu pedido…',
      unavailable: 'Este produto não está disponível no momento.',
      serverErrors: {
        unknown_product: 'Produto desconhecido.',
        invalid_name: 'Informe seu nome.',
        invalid_email: 'Informe um e-mail válido.',
        invalid_document: 'Informe um CPF ou CNPJ válido.',
        product_not_available: 'Este produto não está disponível no momento.',
        payment_not_configured: 'O pagamento online ainda não está configurado.',
        database_not_configured: 'O pagamento online ainda não está configurado.',
        default: 'Algo deu errado. Tente novamente.',
      },
      mpNote: 'Você será redirecionado ao Mercado Pago para concluir o pagamento com Pix, cartão ou boleto.',
    },
  }[locale],
  )

  const errorCopy = (code: string) =>
    copy.serverErrors[code as keyof typeof copy.serverErrors] ?? copy.serverErrors.default

  let name = $state('')
  let email = $state('')
  let company = $state('')
  let document = $state('')
  let terms = $state(false)
  let submitting = $state(false)
  let error = $state('')
  let successRedirect = $state(false)

  const documentType = $derived(/^\d{14}$/.test(document.replace(/\D/g, '')) ? 'CNPJ' : 'CPF')

  const pricingHref = $derived(locale === 'pt-BR' ? '/pt-br/precos/' : '/pricing/')

  async function submit() {
    if (submitting || successRedirect) return
    error = ''

    if (!terms) {
      error = locale === 'pt-BR' ? 'Aceite os termos para continuar.' : 'Please accept the terms to continue.'
      return
    }

    submitting = true
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productId: productSlug,
          customer: {
            name,
            email,
            company: company || undefined,
            documentType,
            document: document.replace(/\D/g, '') || undefined,
          },
          attribution: readStoredAttribution(),
          locale,
        }),
      })
      const data = (await response.json()) as { orderId?: string; initPoint?: string; error?: string }

      if (response.ok && data.initPoint) {
        successRedirect = true
        window.location.href = data.initPoint
        return
      }
      error = errorCopy(data.error ?? 'default')
    } catch {
      error = errorCopy('default')
    } finally {
      submitting = false
    }
  }
</script>

<section class="checkout-page">
  <div class="checkout-inner">
    <a class="checkout-back" href={pricingHref}>{copy.back}</a>

    {#if !price}
      <p class="checkout-unavailable">{copy.unavailable}</p>
    {:else}
      <div class="checkout-grid">
        <div class="checkout-form">
          <p class="section-label motion-rise"><span class="font-jp">{copy.labelJp}</span> {copy.label}</p>
          <h1 class="checkout-heading">{copy.heading}</h1>

          <label class="field">
            <span>{copy.name}</span>
            <input bind:value={name} type="text" autocomplete="name" placeholder={copy.namePh} required />
          </label>
          <label class="field">
            <span>{copy.email}</span>
            <input bind:value={email} type="email" autocomplete="email" placeholder={copy.emailPh} required />
          </label>
          <label class="field">
            <span>{copy.company}</span>
            <input bind:value={company} type="text" autocomplete="organization" placeholder={copy.companyPh} />
          </label>
          <label class="field">
            <span>{copy.document} <small>({documentType})</small></span>
            <input bind:value={document} type="text" inputmode="numeric" autocomplete="off" placeholder={copy.documentPh} />
            <small class="field-hint">{copy.documentHint}</small>
          </label>

          <label class="field terms">
            <input bind:checked={terms} type="checkbox" />
            <span>{copy.terms}</span>
          </label>

          {#if error}<p class="checkout-error" role="alert">{error}</p>{/if}

          <button class="checkout-pay" type="button" onclick={submit} disabled={submitting || successRedirect}>
            {submitting ? copy.paying : copy.pay}
          </button>
          <p class="checkout-note">{copy.mpNote}</p>
        </div>

        <aside class="checkout-summary">
          <h2>{copy.summary}</h2>
          <dl>
            <div><dt>{price.productName}</dt><dd>{formatBRL(price.amountCents)}</dd></div>
            {#if price.discountCents > 0}
              <div><dt>{locale === 'pt-BR' ? 'Desconto' : 'Discount'}</dt><dd>−{formatBRL(price.discountCents)}</dd></div>
            {/if}
            <div class="total"><dt>{locale === 'pt-BR' ? 'Total' : 'Total'}</dt><dd>{formatBRL(price.totalCents)}</dd></div>
          </dl>
        </aside>
      </div>
    {/if}
  </div>
</section>

<style>
  .checkout-page { padding-block: 4rem 6rem; }
  .checkout-inner { max-width: 1080px; margin-inline: auto; padding-inline: 1.5rem; }
  .checkout-back { color: var(--paper-muted); text-decoration: none; font-size: 0.95rem; }
  .checkout-back:hover { color: var(--paper); }
  .checkout-grid { display: grid; grid-template-columns: 1fr 340px; gap: 3rem; margin-top: 2rem; }
  @media (max-width: 860px) { .checkout-grid { grid-template-columns: 1fr; } }
  .checkout-heading { font-size: clamp(1.8rem, 4vw, 2.6rem); line-height: 1.05; margin: 0.5rem 0 2rem; }
  .field { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.1rem; font-size: 0.95rem; }
  .field input[type='text'],
  .field input[type='email'] {
    background: transparent;
    border: 1px solid var(--paper-faint);
    border-radius: 2px;
    color: var(--paper);
    padding: 0.7rem 0.8rem;
    font: inherit;
  }
  .field input:focus { outline: 1px solid var(--verm); border-color: var(--verm); }
  .field-hint { color: var(--paper-muted); font-size: 0.82rem; }
  .terms { flex-direction: row; align-items: flex-start; gap: 0.6rem; }
  .terms input { margin-top: 0.15rem; accent-color: var(--verm); }
  .checkout-error { color: #ffb4a2; border: 1px solid rgba(255, 122, 89, 0.4); padding: 0.6rem 0.8rem; }
  .checkout-pay {
    background: var(--verm);
    color: var(--paper);
    border: none;
    border-radius: 2px;
    padding: 0.85rem 1.4rem;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .checkout-pay:disabled { opacity: 0.6; cursor: progress; }
  .checkout-note { color: var(--paper-muted); font-size: 0.85rem; }
  .checkout-summary { border: 1px solid var(--paper-faint); padding: 1.5rem; align-self: start; }
  .checkout-summary h2 { margin: 0 0 1rem; font-size: 1.05rem; text-transform: uppercase; letter-spacing: 0.08em; }
  .checkout-summary dl { margin: 0; }
  .checkout-summary dl > div { display: flex; justify-content: space-between; gap: 1rem; padding-block: 0.4rem; border-top: 1px solid var(--paper-faint); }
  .checkout-summary dt { color: var(--paper-muted); }
  .checkout-summary .total dt { color: var(--paper); font-weight: 700; }
  .checkout-summary .total dd { font-weight: 700; }
  .checkout-unavailable { color: var(--paper-muted); margin-top: 2rem; }
</style>
