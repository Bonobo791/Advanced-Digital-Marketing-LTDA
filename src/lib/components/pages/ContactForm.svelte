<script lang="ts">
  import { page } from '$app/state'
  import { PAGE_COPY } from '$lib/constants'
  import { submitContactForm } from '$lib/client/contact'
  import type { Locale } from '$lib/locale'

  let { locale }: { locale: Locale } = $props()

  let content = $derived(PAGE_COPY[locale].contact)

  let name = $state('')
  let email = $state('')
  let consent = $state(false)
  let submitting = $state(false)
  let attempted = $state(false)
  let submissionError = $state<string | undefined>(undefined)
  let queryError = $derived(page.url.searchParams.get('error'))
  let errorMessage = $derived(attempted ? submissionError : queryError ? errorMessageFor(queryError) : undefined)
  // Success state: the visitor must check their inbox; the email is echoed
  // back so they know which address the link went to.
  let successEmail = $state<string | undefined>(undefined)
  let successHours = $state(72)
  // Native (no-JS) submission success: the server redirected back with
  // ?sent=1 (the address is not echoed in the URL, so the copy is generic).
  let sent = $derived(page.url.searchParams.get('sent') === '1' && !queryError)
  // Optional subject carried from a service-option CTA (?subject=… on the
  // contact route): it travels through the verification token and lands in
  // the owner notification so the lead names the requested service. The
  // server re-validates it; this is only the prefill.
  let subject = $derived(page.url.searchParams.get('subject')?.trim().slice(0, 120) || undefined)

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
      case 'sandbox_in_production':
      case 'client_address_unavailable':
        return content.serverMisconfigured
      default:
        return content.genericError
    }
  }

  async function submit() {
    if (submitting) return
    attempted = true
    submissionError = undefined

    if (!isValidName(name)) {
      submissionError = content.invalidName
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      submissionError = content.invalidEmail
      return
    }
    if (!consent) {
      submissionError = content.consentRequired
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
        submissionError = errorMessageFor(result.errorCode)
        return
      }
      successEmail = email.trim()
      successHours = result.expiresInHours
    } catch (error) {
      // Fail loudly on the client log; keep the generic message user-facing.
      console.error('[contact] form submission failed', error)
      submissionError = content.genericError
    } finally {
      submitting = false
    }
  }
</script>

{#if sent || successEmail}
  <div class="contact-form__success" role="status">
    <p class="contact-form__success-title">{content.successTitle}</p>
    <p class="contact-form__success-lead">
      {successEmail
        ? content.successLead.replace('{email}', successEmail).replace('{hours}', String(successHours))
        : content.sentLead}
    </p>
  </div>
{:else}
  {#if !successEmail && !submitting}
    <noscript>
      <p class="contact-form__noscript" role="note">
        {content.noscript}
      </p>
    </noscript>
  {/if}
  <!-- method/action give a server-handled fallback when JavaScript is off or
       hydration fails: the native POST goes to /api/contact/submit (which
       accepts urlencoded bodies), so the visitor's data never lands in the
       URL query string and the request still reaches the server. With JS on,
       the onsubmit handler below preventDefaults and runs the normal flow. -->
  <form
    class="contact-form"
    method="post"
    action="/api/contact/submit"
    onsubmit={(e) => { e.preventDefault(); submit() }}
    novalidate
  >
    <input type="hidden" name="locale" value={locale} />
    {#if subject}<input type="hidden" name="subject" value={subject} />{/if}
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
        aria-describedby={errorMessage === content.invalidName ? 'contact-form-error' : undefined}
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
        aria-describedby={errorMessage === content.invalidEmail ? 'contact-form-error' : undefined}
      />
    </label>

    <label class="contact-form__consent">
      <input
        type="checkbox"
        name="consent"
        checked={consent}
        onchange={(e) => (consent = (e.currentTarget as HTMLInputElement).checked)}
        disabled={submitting}
        aria-invalid={errorMessage === content.consentRequired}
        aria-describedby={errorMessage === content.consentRequired ? 'contact-form-error' : undefined}
      />
      <span>{content.consentLabel}</span>
    </label>

    {#if errorMessage}
      <p id="contact-form-error" class="contact-form__error" role="alert">{errorMessage}</p>
    {/if}

    <button class="button button--solid" type="submit" disabled={submitting}>
      {submitting ? content.submitting : content.submit}
    </button>
  </form>
{/if}
