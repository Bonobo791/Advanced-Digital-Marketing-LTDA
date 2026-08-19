/**
 * Guards the option-CTA anchor invariant: one-time and free options must never
 * default into the recurring subscription checkout (#subscribe) or inherit a
 * pricing section that does not contain them (#builds for the one-time web
 * audits/sprints) — they resolve to the contact form (with the option's
 * subject when it has one).
 *
 * The resolution uses the same `resolveOptionCtaHref` that `ServicePage.svelte`
 * renders with, so the test guards the real click destination — never the raw
 * data field.
 */
import { describe, expect, it } from 'vitest'
import { resolveOptionCtaHref, SERVICE_CONTENT } from './services'

const CONTACT_ROUTE = '/contact/'

describe('service option CTA anchors', () => {
  it('routes every one-time or free option to the contact form (never a pricing section)', () => {
    for (const locale of ['en-US', 'pt-BR'] as const) {
      for (const service of Object.values(SERVICE_CONTENT[locale])) {
        for (const option of service.options) {
          const isRecurring = option.per.includes('Per month') || option.per.includes('Por mês')
          if (!isRecurring) {
            const href = resolveOptionCtaHref(option, service, CONTACT_ROUTE)
            expect(
              href.startsWith(CONTACT_ROUTE),
              `${locale} · ${service.navLabel} · ${option.name} must resolve to the contact form, not a pricing section (got ${href})`,
            ).toBe(true)
          }
        }
      }
    }
  })

  it('never points any option at the recurring checkout anchor', () => {
    for (const locale of ['en-US', 'pt-BR'] as const) {
      for (const service of Object.values(SERVICE_CONTENT[locale])) {
        for (const option of service.options) {
          const isRecurring = option.per.includes('Per month') || option.per.includes('Por mês')
          if (!isRecurring) {
            const href = resolveOptionCtaHref(option, service, CONTACT_ROUTE)
            expect(
              href,
              `${locale} · ${service.navLabel} · ${option.name} must not link to the recurring checkout`,
            ).not.toMatch(/^#/)
          }
        }
      }
    }
  })

  it('preselects only the clicked Technical SEO option in the configurator', () => {
    // Content Development / Backlinks share the #subscribe panel but are
    // different catalog services: the CTA must carry the clicked option so
    // the panel never seeds the other one too (and never the R$5,000
    // combined package for a single-card click).
    for (const locale of ['en-US', 'pt-BR'] as const) {
      const technicalSeo = SERVICE_CONTENT[locale]['technical-seo']
      const content = technicalSeo.options.find((o) => o.subject === 'Content development request')!
      const backlinks = technicalSeo.options.find((o) => o.subject === 'Backlinks request')!
      expect(resolveOptionCtaHref(content, technicalSeo, CONTACT_ROUTE)).toBe(
        '?preselect=seo-content#subscribe',
      )
      expect(resolveOptionCtaHref(backlinks, technicalSeo, CONTACT_ROUTE)).toBe(
        '?preselect=backlinks#subscribe',
      )
    }
  })

  it('keeps fixed-price retainer CTAs out of the recurring checkout configurator', () => {
    // The Build/Paid/Meta/Visibility retainers are fixed-price monthly
    // products the subscription catalog does not contain (the configurator
    // prices the spend-based ads products or only hosting), so their CTAs
    // must go to the contact form with the subject — never to #subscribe,
    // where the visitor would be quoted a different product.
    const retainerSubjects = [
      'Build retainer inquiry',
      'Paid retainer inquiry',
      'Meta retainer inquiry',
      'Visibility retainer inquiry',
    ]
    for (const locale of ['en-US', 'pt-BR'] as const) {
      for (const service of Object.values(SERVICE_CONTENT[locale])) {
        for (const option of service.options) {
          if (!retainerSubjects.includes(option.subject)) continue
          const href = resolveOptionCtaHref(option, service, CONTACT_ROUTE)
          expect(href.startsWith(CONTACT_ROUTE), `${locale} · ${service.navLabel} · ${option.name} (got ${href})`).toBe(true)
          expect(href).toContain(encodeURIComponent(option.subject))
        }
      }
    }
  })

  it('carries the option subject into the contact URL when the anchor resolves to the form', () => {
    // The shared resolver must produce the same href ServicePage renders:
    // explicit null → /contact/?subject=… when the option has one.
    const option = { pricingAnchor: null as string | null, subject: 'Build audit request' }
    expect(resolveOptionCtaHref(option, { pricingAnchor: '#builds' }, CONTACT_ROUTE)).toBe(
      '/contact/?subject=Build%20audit%20request',
    )
    expect(resolveOptionCtaHref({ ...option, subject: undefined }, { pricingAnchor: '#builds' }, CONTACT_ROUTE)).toBe(
      '/contact/',
    )
    // Explicit anchor wins over both the service default and the subject.
    expect(resolveOptionCtaHref({ ...option, pricingAnchor: '#subscribe' }, { pricingAnchor: '#builds' }, CONTACT_ROUTE)).toBe(
      '#subscribe',
    )
  })
})
