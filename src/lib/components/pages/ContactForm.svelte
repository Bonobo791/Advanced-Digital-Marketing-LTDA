<script lang="ts">
  import { onMount } from 'svelte'
  import { PAGE_COPY } from '$lib/constants'
  import { submitContactForm } from '$lib/client/contact'
  import type { Locale } from '$lib/locale'

  let { locale }: { locale: Locale } = $props()

  let content = $derived(PAGE_COPY[locale].contact)

  let name = $state('')
  let email = $state('')
  let consent = $state(false)
  let submitting = $state(false)
  let errorMessage = $state<string | undefined>(undefined)
  // Success state: the visitor must check their inbox; the email is echoed
  // back so they know which address the link went to.
  let successEmail = $state<string | undefined>(undefined)
  let successHours = $state(72)
  // Optional subject carried from a service-option CTA (?subject=… on the
  // contact route): it travels through the verification token and lands in
  // the owner notification so the lead names the requested service. The
  // server re-validates it; this is only the prefill.
  let subject = $state<string | undefined>(undefined)

  onMount(() => {
    const value = new URL(window.location.href).searchParams.get('subject')?.trim()
    if (value) subject = value.slice(0, 120)
  })

  // Mirrors the server's linear shape check in $lib/server/checkout.ts.
  const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/

  function isValidName(value: string): boolean {
    const trimmed = value.trim()
    return trimmed.length >= 1 && trimmed.length <= 100
  }

  function errorMessageFor(code: string | undefined): string {
    switch (code) {
      case 'invalid_name':
        return content.invalidName
      case 'invalid_email':
        return content.invalidEmail
      case 'consent_required':
        return content.consentRequired
      case 'rate_limited':
        return content.rateLimited
      // Configuration/upstream failures are all "not ready yet" for the
      // visitor; the server logs the specific code.
      case 'server_misconfigured':
      case 'missing_credentials':
      case 'unauthorized':
      case 'sender_not_authorized':
      case 'message_rejected':
      case 'api_error':
      case 'timeout':
      case 'invalid_response':
      case 'client_address_unavailable':
        return content.serverMisconfigured
      default:
        return content.genericError
    }
  }

  async function submit() {
    if (submitting) return
    errorMessage = undefined

    if (!isValidName(name)) {
      errorMessage = content.invalidName
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      errorMessage = content.invalidEmail
      return
    }
    if (!consent) {
      errorMessage = content.consentRequired
      return
    }

    submitting = true
    try {
      const result = await submitContactForm('/api/contact/submit', {
        name: name.trim(),
        email: email.trim(),
        consent: true,
        locale,
        ...(subject ? { subject } : {}),
      })
      if (!result.ok) {
        errorMessage = errorMessageFor(result.errorCode)
        return
      }
      successEmail = email.trim()
      successHours = result.expiresInHours
    } catch (error) {
      // Fail loudly on the client log; keep the generic message user-facing.
      console.error('[contact] form submission failed', error)
      errorMessage = content.genericError
    } finally {
      submitting = false
    }
  }
</script>

{#if successEmail}
  <div class="contact-form__success" role="status">
    <p class="contact-form__success-title">{content.successTitle}</p>
    <p class="contact-form__success-lead">
      {content.successLead.replace('{email}', successEmail).replace('{hours}', String(successHours))}
    </p>
  </div>
{:else}
  <form class="contact-form" onsubmit={(e) => { e.preventDefault(); submit() }} novalidate>
    <label class="contact-form__field">
      <span>{content.nameLabel}</span>
      <input
        type="text"
        name="name"
        autocomplete="name"
        maxlength="100"
        placeholder={content.namePlaceholder}
        value={name}
        oninput={(e) => (name = (e.currentTarget as HTMLInputElement).value)}
        disabled={submitting}
        aria-invalid={errorMessage === content.invalidName}
      />
    </label>

    <label class="contact-form__field">
      <span>{content.emailLabel}</span>
      <input
        type="email"
        name="email"
        autocomplete="email"
        maxlength="254"
        placeholder={content.emailPlaceholder}
        value={email}
        oninput={(e) => (email = (e.currentTarget as HTMLInputElement).value)}
        disabled={submitting}
        aria-invalid={errorMessage === content.invalidEmail}
      />
    </label>

    <label class="contact-form__consent">
      <input
        type="checkbox"
        name="consent"
        checked={consent}
        onchange={(e) => (consent = (e.currentTarget as HTMLInputElement).checked)}
        disabled={submitting}
      />
      <span>{content.consentLabel}</span>
    </label>

    {#if errorMessage}
      <p class="contact-form__error" role="alert">{errorMessage}</p>
    {/if}

    <button class="button button--solid" type="submit" disabled={submitting}>
      {submitting ? content.submitting : content.submit}
    </button>
  </form>
{/if}
