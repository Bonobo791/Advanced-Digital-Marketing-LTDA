export type CopySection = { heading: string; html: string }

export type TechnicalSeoContent = {
  title: string
  intro: string
  symptoms: CopySection
  scopeHeading: string
  scope: CopySection[]
  example: CopySection
  deliverables: CopySection
  access: CopySection
  faqHeading: string
  faqs: CopySection[]
  contact: CopySection
}
