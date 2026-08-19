/**
 * Guards the option-CTA anchor invariant: one-time and free options must never
 * default into the recurring subscription checkout (#subscribe) or inherit a
 * pricing section that does not contain them (#builds for the one-time web
 * audits/sprints) — they either carry an explicit pricing anchor of their own
 * or funnel to the contact form.
 *
 * Anchors are resolved exactly as `ServicePage.svelte` resolves them
 * (`option.pricingAnchor === null ? null : option.pricingAnchor ?? service.pricingAnchor ?? null`),
 * so the test guards the real click destination, not the raw data field.
 */
import { describe, expect, it } from 'vitest'
import { SERVICE_CONTENT } from './services'

/** Mirrors ServicePage.svelte's resolution: null means the contact form. */
function resolvedAnchor(
  option: { pricingAnchor?: string | null },
  service: { pricingAnchor?: string },
): string | null {
  return option.pricingAnchor === null ? null : option.pricingAnchor ?? service.pricingAnchor ?? null
}

describe('service option CTA anchors', () => {
  it('routes every one-time or free option to the contact form (resolved null)', () => {
    for (const locale of ['en-US', 'pt-BR'] as const) {
      for (const service of Object.values(SERVICE_CONTENT[locale])) {
        for (const option of service.options) {
          const isRecurring = option.per.includes('Per month') || option.per.includes('Por mês')
          if (!isRecurring) {
            expect(
              resolvedAnchor(option, service),
              `${locale} · ${service.navLabel} · ${option.name} must resolve to the contact form, not a pricing section`,
            ).toBeNull()
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
            expect(
              resolvedAnchor(option, service),
              `${locale} · ${service.navLabel} · ${option.name} must not link to the recurring checkout`,
            ).not.toBe('#subscribe')
          }
        }
      }
    }
  })
})
