/**
 * Guards the option-CTA anchor invariant: one-time and free options must never
 * default into the recurring subscription checkout (#subscribe) — they either
 * carry an explicit pricing anchor of their own or funnel to the contact form.
 */
import { describe, expect, it } from 'vitest'
import { SERVICE_CONTENT } from './services'

describe('service option CTA anchors', () => {
  it('never points one-time or free options at the recurring checkout anchor', () => {
    for (const locale of ['en-US', 'pt-BR'] as const) {
      for (const service of Object.values(SERVICE_CONTENT[locale])) {
        for (const option of service.options) {
          const isRecurring = option.per.includes('Per month') || option.per.includes('Por mês')
          if (!isRecurring) {
            expect(
              option.pricingAnchor,
              `${locale} · ${service.navLabel} · ${option.name} must not link to the recurring checkout`,
            ).not.toBe('#subscribe')
          }
        }
      }
    }
  })
})
