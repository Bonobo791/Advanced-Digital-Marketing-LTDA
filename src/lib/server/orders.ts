/**
 * Orders repository — persistence and status lifecycle for checkout orders.
 *
 * Each order snapshots the price it was sold at (price_id, product_name,
 * currency, amount/subtotal/discount/total) so later price changes never
 * rewrite history.
 *
 * Works against any client exposing libSQL's `execute({ sql, args })` shape,
 * so tests can use a real in-memory libSQL database.
 */
import { randomUUID } from 'node:crypto'
import type { Attribution } from '$lib/attribution'
import type { CheckoutPrice } from './pricing'
import type { SqlDb } from './sql'

export const ORDER_STATUSES = ['created', 'pending', 'approved', 'rejected', 'refunded'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export interface CustomerDetails {
  name: string
  email: string
  company?: string
  documentType?: 'CPF' | 'CNPJ'
  document?: string
}

export interface CreateOrderInput {
  productId: string
  /** Server-computed price snapshot (see pricing.resolveCheckoutPrice). */
  price: CheckoutPrice
  customer: CustomerDetails
  attribution?: Attribution
}

export interface Order {
  id: string
  productId: string
  priceId: string
  productName: string
  currency: string
  /** Unit price snapshot (the `prices.amount_cents` at checkout time). */
  amountCents: number
  subtotalCents: number
  discountCents: number
  /** The amount actually charged (subtotal - discount). */
  totalCents: number
  promotionId: string | null
  customerName: string
  customerEmail: string
  customerCompany: string | null
  customerDocumentType: 'CPF' | 'CNPJ' | null
  customerDocument: string | null
  status: OrderStatus
  attribution: Attribution
  mpPaymentId: string | null
  transactionId: string | null
  mpStatus: string | null
  mpStatusDetail: string | null
  mpPaymentMethod: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Allowed status transitions. `created` is the initial state; `rejected` and
 * `refunded` are terminal. Re-applying the current status is a no-op (this is
 * what makes duplicate webhooks idempotent).
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  created: ['pending', 'approved', 'rejected'],
  pending: ['approved', 'rejected'],
  // `pending` lets an approved order whose funds are held in mediation be
  // reflected as pending. The regression is gated on the incoming mpStatus
  // in updateOrderStatus — a plain `pending` notification never downgrades
  // an approved order.
  approved: ['refunded', 'pending'],
  rejected: [],
  refunded: [],
}

/** Mercado Pago payment status -> internal order status. */
const MP_STATUS_TO_ORDER: Record<string, OrderStatus> = {
  approved: 'approved',
  pending: 'pending',
  in_process: 'pending',
  authorized: 'pending',
  rejected: 'rejected',
  cancelled: 'rejected',
  // A dispute holds the funds — reflect it as pending rather than approved.
  in_mediation: 'pending',
  // A chargeback takes money back after approval — treat it as a refund.
  charged_back: 'refunded',
  refunded: 'refunded',
}

export function mapMpStatusToOrderStatus(mpStatus: string): OrderStatus | undefined {
  return MP_STATUS_TO_ORDER[mpStatus]
}

const ORDER_COLUMNS = `
  id, product_id AS productId, price_id AS priceId, product_name AS productName,
  currency, amount_cents AS amountCents, subtotal_cents AS subtotalCents,
  discount_cents AS discountCents, total_cents AS totalCents, promotion_id AS promotionId,
  customer_name AS customerName, customer_email AS customerEmail,
  customer_company AS customerCompany,
  customer_document_type AS customerDocumentType,
  customer_document AS customerDocument,
  status,
  utm_source AS utmSource, utm_medium AS utmMedium,
  utm_campaign AS utmCampaign, utm_content AS utmContent,
  utm_term AS utmTerm,
  gclid, gbraid, wbraid, fbclid,
  landing_page AS landingPage, referrer,
  mp_payment_id AS mpPaymentId, transaction_id AS transactionId,
  mp_status AS mpStatus, mp_status_detail AS mpStatusDetail,
  mp_payment_method AS mpPaymentMethod,
  created_at AS createdAt, updated_at AS updatedAt
`

interface OrderRowShape {
  id: string
  productId: string
  priceId: string
  productName: string
  currency: string
  amountCents: number
  subtotalCents: number
  discountCents: number
  totalCents: number
  promotionId: string | null
  customerName: string
  customerEmail: string
  customerCompany: string | null
  customerDocumentType: 'CPF' | 'CNPJ' | null
  customerDocument: string | null
  status: string
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
  utmTerm: string | null
  gclid: string | null
  gbraid: string | null
  wbraid: string | null
  fbclid: string | null
  landingPage: string | null
  referrer: string | null
  mpPaymentId: string | null
  transactionId: string | null
  mpStatus: string | null
  mpStatusDetail: string | null
  mpPaymentMethod: string | null
  createdAt: string
  updatedAt: string
}

function optional(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function toOrder(row: OrderRowShape): Order {
  if (!ORDER_STATUSES.includes(row.status as OrderStatus)) {
    throw new Error(`Unknown order status: ${row.status}`)
  }
  return {
    id: row.id,
    productId: row.productId,
    priceId: row.priceId,
    productName: row.productName,
    currency: row.currency,
    amountCents: Number(row.amountCents),
    subtotalCents: Number(row.subtotalCents),
    discountCents: Number(row.discountCents),
    totalCents: Number(row.totalCents),
    promotionId: optional(row.promotionId) ?? null,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    customerCompany: optional(row.customerCompany) ?? null,
    customerDocumentType:
      row.customerDocumentType === 'CPF' || row.customerDocumentType === 'CNPJ'
        ? row.customerDocumentType
        : null,
    customerDocument: optional(row.customerDocument) ?? null,
    status: row.status as OrderStatus,
    attribution: {
      utmSource: optional(row.utmSource),
      utmMedium: optional(row.utmMedium),
      utmCampaign: optional(row.utmCampaign),
      utmContent: optional(row.utmContent),
      utmTerm: optional(row.utmTerm),
      gclid: optional(row.gclid),
      gbraid: optional(row.gbraid),
      wbraid: optional(row.wbraid),
      fbclid: optional(row.fbclid),
      landingPage: optional(row.landingPage),
      referrer: optional(row.referrer),
    },
    mpPaymentId: optional(row.mpPaymentId) ?? null,
    transactionId: optional(row.transactionId) ?? null,
    mpStatus: optional(row.mpStatus) ?? null,
    mpStatusDetail: optional(row.mpStatusDetail) ?? null,
    mpPaymentMethod: optional(row.mpPaymentMethod) ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toOrderOrUndefined(
  rows: ReadonlyArray<Record<string, unknown>> | undefined,
): Order | undefined {
  if (!rows || rows.length === 0) return undefined
  return toOrder(rows[0] as unknown as OrderRowShape)
}

export async function createOrder(db: SqlDb, input: CreateOrderInput): Promise<Order> {
  const now = new Date().toISOString()
  const id = randomUUID()
  const { customer, attribution, price } = input

  await db.execute({
    sql: `
      INSERT INTO orders (
        id, product_id, price_id, product_name, currency,
        amount_cents, subtotal_cents, discount_cents, total_cents, promotion_id,
        customer_name, customer_email, customer_company,
        customer_document_type, customer_document,
        status, transaction_id,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        gclid, gbraid, wbraid, fbclid,
        landing_page, referrer,
        created_at, updated_at
      ) VALUES (
        :id, :productId, :priceId, :productName, :currency,
        :amountCents, :subtotalCents, :discountCents, :totalCents, :promotionId,
        :customerName, :customerEmail, :customerCompany,
        :customerDocumentType, :customerDocument,
        'created', :transactionId,
        :utmSource, :utmMedium, :utmCampaign, :utmContent, :utmTerm,
        :gclid, :gbraid, :wbraid, :fbclid,
        :landingPage, :referrer,
        :createdAt, :updatedAt
      )
    `,
    args: {
      id,
      productId: input.productId,
      priceId: price.priceId,
      productName: price.productName,
      currency: price.currency,
      amountCents: price.amountCents,
      subtotalCents: price.subtotalCents,
      discountCents: price.discountCents,
      totalCents: price.totalCents,
      promotionId: price.promotionId ?? null,
      customerName: customer.name,
      customerEmail: customer.email,
      customerCompany: customer.company || null,
      customerDocumentType: customer.documentType || null,
      customerDocument: customer.document || null,
      transactionId: id,
      utmSource: attribution?.utmSource || null,
      utmMedium: attribution?.utmMedium || null,
      utmCampaign: attribution?.utmCampaign || null,
      utmContent: attribution?.utmContent || null,
      utmTerm: attribution?.utmTerm || null,
      gclid: attribution?.gclid || null,
      gbraid: attribution?.gbraid || null,
      wbraid: attribution?.wbraid || null,
      fbclid: attribution?.fbclid || null,
      landingPage: attribution?.landingPage || null,
      referrer: attribution?.referrer || null,
      createdAt: now,
      updatedAt: now,
    },
  })

  const order = await getOrder(db, id)
  if (!order) throw new Error('Failed to read back the created order')
  return order
}

export async function getOrder(db: SqlDb, id: string): Promise<Order | undefined> {
  const result = await db.execute({
    sql: `SELECT ${ORDER_COLUMNS} FROM orders WHERE id = :id`,
    args: { id },
  })
  return toOrderOrUndefined(result.rows)
}

export async function getOrderByPaymentId(
  db: SqlDb,
  mpPaymentId: string,
): Promise<Order | undefined> {
  const result = await db.execute({
    sql: `SELECT ${ORDER_COLUMNS} FROM orders WHERE mp_payment_id = :mpPaymentId`,
    args: { mpPaymentId },
  })
  return toOrderOrUndefined(result.rows)
}

export interface AttachResult {
  ok: boolean
  order?: Order
}

/**
 * Attaches the Mercado Pago payment id to an order. Only the first attachment
 * wins (an order maps to exactly one payment).
 */
export async function attachMpPayment(
  db: SqlDb,
  orderId: string,
  mpPaymentId: string,
): Promise<AttachResult> {
  const result = await db.execute({
    sql: `
      UPDATE orders
      SET mp_payment_id = :mpPaymentId, updated_at = :updatedAt
      WHERE id = :orderId AND (mp_payment_id IS NULL OR mp_payment_id = :mpPaymentId)
    `,
    args: { mpPaymentId, orderId, updatedAt: new Date().toISOString() },
  })
  const order = await getOrder(db, orderId)
  return { ok: (result.rowsAffected ?? 0) > 0, order }
}

export type UpdateStatusResult =
  | { ok: true; order: Order }
  | { ok: false; reason: 'not_found' | 'invalid_transition'; order?: Order }

export interface StatusChange {
  mpStatus?: string
  mpStatusDetail?: string
  mpPaymentMethod?: string
}

/**
 * Applies a status change with transition guarding and idempotency: re-applying
 * the current status succeeds without touching the row, so duplicate webhook
 * deliveries are safe.
 */
export async function updateOrderStatus(
  db: SqlDb,
  orderId: string,
  nextStatus: OrderStatus,
  change: StatusChange = {},
): Promise<UpdateStatusResult> {
  const current = await getOrder(db, orderId)
  if (!current) return { ok: false, reason: 'not_found' }

  if (current.status === nextStatus) {
    return { ok: true, order: current }
  }

  if (!ALLOWED_TRANSITIONS[current.status].includes(nextStatus)) {
    return { ok: false, reason: 'invalid_transition', order: current }
  }

  // An approved order may only regress to pending while a dispute holds the
  // funds (in_mediation) — never from a plain `pending` notification, which
  // would silently roll back an already-approved order.
  if (current.status === 'approved' && nextStatus === 'pending' && change.mpStatus !== 'in_mediation') {
    return { ok: false, reason: 'invalid_transition', order: current }
  }

  // Atomic single-statement transition: the WHERE clause re-checks the status
  // read above, so concurrent webhook deliveries can't both win — the loser
  // updates 0 rows and we re-read the authoritative state.
  const result = await db.execute({
    sql: `
      UPDATE orders
      SET status = :status,
          mp_status = :mpStatus,
          mp_status_detail = :mpStatusDetail,
          mp_payment_method = :mpPaymentMethod,
          updated_at = :updatedAt
      WHERE id = :orderId AND status = :expectedStatus
    `,
    args: {
      orderId,
      expectedStatus: current.status,
      status: nextStatus,
      mpStatus: change.mpStatus ?? null,
      mpStatusDetail: change.mpStatusDetail ?? null,
      mpPaymentMethod: change.mpPaymentMethod ?? null,
      updatedAt: new Date().toISOString(),
    },
  })

  if ((result.rowsAffected ?? 0) === 0) {
    // Lost a race: the row moved under us. Report the authoritative state.
    const latest = await getOrder(db, orderId)
    if (!latest) return { ok: false, reason: 'not_found' }
    return latest.status === nextStatus
      ? { ok: true, order: latest }
      : { ok: false, reason: 'invalid_transition', order: latest }
  }

  const updated = await getOrder(db, orderId)
  if (!updated) return { ok: false, reason: 'not_found' }
  return { ok: true, order: updated }
}
