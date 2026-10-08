import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'svelte/server'
import ContactForm from './ContactForm.svelte'
import { PAGE_COPY } from '$lib/constants'
import type { Locale } from '$lib/locale'

const state = vi.hoisted(() => ({ page: { url: new URL('http://localhost/contact/') } }))
vi.mock('$app/state', () => state)

describe.each<Locale>(['en-US', 'pt-BR'])('ContactForm server HTML (%s)', (locale) => {
  beforeEach(() => { state.page.url = new URL('http://localhost/contact/') })

  const htmlFor = (query: string) => {
    state.page.url.search = query
    return render(ContactForm, { props: { locale } }).body
  }

  it('renders the native success outcome before hydration', () => {
    const html = htmlFor('?sent=1')
    expect(html).toContain('role="status"')
    expect(html).toContain(PAGE_COPY[locale].contact.successTitle)
    expect(html).toContain(PAGE_COPY[locale].contact.sentLead)
    expect(html).not.toContain('<form')
  })

  it.each(['invalid_name', 'invalid_email', 'consent_required', 'rate_limited', 'timeout', 'unknown'])('renders an accessible recovery form for %s', (code) => {
    const copy = PAGE_COPY[locale].contact
    const messages: Record<string, string> = {
      invalid_name: copy.invalidName, invalid_email: copy.invalidEmail,
      consent_required: copy.consentRequired, rate_limited: copy.rateLimited,
      timeout: copy.serverMisconfigured, unknown: copy.genericError,
    }
    const html = htmlFor(`?error=${code}`)
    expect(html).toContain('role="alert"')
    expect(html).toContain(messages[code])
    expect(html).toContain('method="post" action="/api/contact/submit"')
    expect(html).not.toContain('role="status"')
    if (['invalid_name', 'invalid_email', 'consent_required'].includes(code)) {
      expect(html).toContain('aria-invalid="true"')
      expect(html).toContain('aria-describedby="contact-form-error"')
    }
  })

  it('includes the selected service in the native form with escaped markup', () => {
    const html = htmlFor('?subject=' + encodeURIComponent(' Account audit & "review" <service> '))
    expect(html).toContain('name="subject" value="Account audit &amp; &quot;review&quot; &lt;service>"')
  })

  it('keeps the existing 120-character subject limit', () => {
    const html = htmlFor('?subject=' + 'x'.repeat(121))
    expect(html).toContain(`name="subject" value="${'x'.repeat(120)}"`)
  })

  it('shows the error when conflicting outcome markers are supplied', () => {
    const html = htmlFor('?sent=1&error=invalid_email')
    expect(html).toContain(PAGE_COPY[locale].contact.invalidEmail)
    expect(html).not.toContain('role="status"')
  })
})
