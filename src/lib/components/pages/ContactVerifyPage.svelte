<script lang="ts">
  import Kanji from '$lib/components/chrome/Kanji.svelte'
  import { JP } from '$lib/constants'
  import { LOCALE_ROUTES, type Locale } from '$lib/locale'
  import type { ContactVerifyResult } from '$lib/server/contact'

  let { locale, verify }: { locale: Locale; verify: ContactVerifyResult } = $props()

  const copy = {
    'en-US': {
      verifiedTitle: 'Email verified.',
      verifiedLead: (name: string) =>
        `Thanks, ${name} — your email address is confirmed and your contact request is with the owner. Expect a reply within one business day.`,
      invalidTitle: 'This link is not valid.',
      invalidLead: 'The verification link is not valid. It may have been copied incorrectly — or it belongs to another address. Please submit the form again to receive a fresh link.',
      expiredTitle: 'This link has expired.',
      expiredLead: 'Verification links expire after 72 hours. Please submit the form again to receive a fresh link.',
      back: 'Back to the contact form',
    },
    'pt-BR': {
      verifiedTitle: 'E-mail verificado.',
      verifiedLead: (name: string) =>
        `Obrigado, ${name} — seu e-mail foi confirmado e sua solicitação de contato está com o responsável. A resposta chega em até um dia útil.`,
      invalidTitle: 'Este link não é válido.',
      invalidLead: 'O link de verificação não é válido. Ele pode ter sido copiado incorretamente — ou pertence a outro endereço. Envie o formulário novamente para receber um novo link.',
      expiredTitle: 'Este link expirou.',
      expiredLead: 'Os links de verificação expiram após 72 horas. Envie o formulário novamente para receber um novo link.',
      back: 'Voltar ao formulário de contato',
    },
  } as const

  let text = $derived(copy[locale])
  let title = $derived(
    verify.status === 'verified' ? text.verifiedTitle : verify.status === 'expired' ? text.expiredTitle : text.invalidTitle,
  )
  let lead = $derived(
    verify.status === 'verified'
      ? text.verifiedLead(verify.name)
      : verify.status === 'expired'
        ? text.expiredLead
        : text.invalidLead,
  )
</script>

<svelte:head>
  <meta name="robots" content="noindex" />
</svelte:head>

<section class="editorial-subhero contact-verify">
  <Kanji char={JP.seal} onRed class="subhero-kanji" />
  <div class="subhero-grid">
    <div class="subhero-copy">
      <p class="section-label motion-rise"><span class="font-jp">連絡</span> {locale === 'pt-BR' ? 'Contato' : 'Contact'}</p>
      <h1 class="motion-subhero-heading"><span>{title}</span></h1>
      <p class="motion-rise">{lead}</p>
      <a class="button button--solid" href={LOCALE_ROUTES.contact[locale]}>{text.back} <span aria-hidden="true">→</span></a>
    </div>
  </div>
</section>
