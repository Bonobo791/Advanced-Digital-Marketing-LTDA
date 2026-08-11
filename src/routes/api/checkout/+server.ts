import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { sanitizeAttribution } from '$lib/attribution'
import { getDb } from '$lib/server/db'
import { createCheckoutPreference } from '$lib/server/mercadopago'
import { createOrder, type CustomerDetails } from '$lib/server/orders'
import { resolveCheckoutPrice } from '$lib/server/pricing'
import { isProductId } from '$lib/server/products'
import { isValidDocument, isValidEmail, type DocumentType } from '$lib/server/validators'

export const prerender = false
export const trailingSlash = 'ignore'

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

interface CheckoutBody {
  productId?: unknown
  promotionCode?: unknown
  customer?: unknown
  attribution?: unknown
  locale?: unknown
}

/**
 * POST /api/checkout
 *
 * 1. Validate the product slug (never an amount from the browser)
 * 2. Resolve the current price from Turso (server-authoritative)
 * 3. Create the local order, snapshotting the price
 * 4. Create a Mercado Pago Checkout Pro preference (external_reference =
 *    order id, back_urls, notification_url, auto_return)
 * 5. Return the Mercado Pago init_point for the browser to redirect to
 */
export const POST: RequestHandler = async ({ request }) => {
  let body: CheckoutBody
  try {
    body = (await request.json()) as CheckoutBody
  } catch {
    return json({ error: 'invalid_json' }, { status: 400 })
  }

  const productId = cleanString(body.productId)
  if (!productId || !isProductId(productId)) {
    return json({ error: 'unknown_product' }, { status: 400 })
  }

  const customer = body.customer
  if (typeof customer !== 'object' || customer === null) {
    return json({ error: 'invalid_customer' }, { status: 400 })
  }
  const customerRecord = customer as Record<string, unknown>
  const name = cleanString(customerRecord.name)
  const email = cleanString(customerRecord.email)
  if (!name) return json({ error: 'invalid_name' }, { status: 400 })
  if (!email || !isValidEmail(email)) return json({ error: 'invalid_email' }, { status: 400 })

  const company = cleanString(customerRecord.company)
  const documentType =
    customerRecord.documentType === 'CPF' || customerRecord.documentType === 'CNPJ'
      ? (customerRecord.documentType as DocumentType)
      : undefined
  const document = cleanString(customerRecord.document)
  if (document && (!documentType || !isValidDocument(documentType, document))) {
    return json({ error: 'invalid_document' }, { status: 400 })
  }

  const promotionCode = cleanString(body.promotionCode)
  const locale = body.locale === 'pt-BR' ? 'pt-BR' : 'en-US'

  const db = await getDb().catch(() => undefined)
  if (!db) return json({ error: 'database_not_configured' }, { status: 503 })

  const price = await resolveCheckoutPrice(db, productId, promotionCode)
  if (!price) {
    return json({ error: 'product_not_available' }, { status: 400 })
  }

  const customerDetails: CustomerDetails = { name, email, company, documentType, document }
  const order = await createOrder(db, {
    productId,
    price,
    customer: customerDetails,
    attribution: sanitizeAttribution(body.attribution),
  })

  const origin = process.env.URL ?? new URL(request.url).origin
  const checkoutBase = locale === 'pt-BR' ? `${origin}/pt-br/checkout` : `${origin}/checkout`
  const preference = await createCheckoutPreference({
    externalReference: order.id,
    title: price.productName,
    description: `${price.productName} — ${price.currency}`,
    currency: price.currency,
    unitPriceCents: price.totalCents,
    backUrls: {
      success: `${checkoutBase}/success?order_id=${order.id}`,
      pending: `${checkoutBase}/pending?order_id=${order.id}`,
      failure: `${checkoutBase}/failure?order_id=${order.id}`,
    },
    notificationUrl: `${origin}/api/webhooks/mercadopago`,
    payerEmail: email,
  })

  if (!preference) {
    return json({ error: 'payment_not_configured' }, { status: 503 })
  }

  return json({ orderId: order.id, initPoint: preference.initPoint })
}
