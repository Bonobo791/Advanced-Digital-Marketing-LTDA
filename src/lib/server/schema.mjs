/**
 * SQLite schema for the pricing + orders persistence layer (Turso / libSQL).
 *
 * Pricing is versioned and append-only: a price change deactivates the old
 * `prices` row (active = 0, effective_until set) and inserts a new one —
 * historical price rows are never mutated. Orders snapshot the price they
 * were sold at (`price_id`, `product_name`, `amount_cents`, `currency`).
 *
 * `getDb()` applies this plus the seed (`seed.mjs`) idempotently on cold
 * start; `scripts/migrate.mjs` applies them on demand. Keep both idempotent.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prices (
  id              TEXT PRIMARY KEY,
  product_id      TEXT NOT NULL REFERENCES products(id),
  currency        TEXT NOT NULL DEFAULT 'BRL',
  amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
  billing_type    TEXT NOT NULL CHECK (billing_type IN ('one_time', 'recurring')),
  interval        TEXT CHECK (interval IN ('month', 'year') OR interval IS NULL),
  active          INTEGER NOT NULL DEFAULT 1,
  effective_from  TEXT NOT NULL,
  effective_until TEXT,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prices_product ON prices (product_id);
CREATE INDEX IF NOT EXISTS idx_prices_active ON prices (product_id, active);

CREATE TABLE IF NOT EXISTS price_adjustments (
  id         TEXT PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,
  type       TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value      INTEGER NOT NULL CHECK (value > 0),
  starts_at  TEXT,
  expires_at TEXT,
  max_uses   INTEGER,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id                     TEXT PRIMARY KEY,
  product_id             TEXT NOT NULL,
  price_id               TEXT NOT NULL,
  product_name           TEXT NOT NULL,
  currency               TEXT NOT NULL DEFAULT 'BRL',
  amount_cents           INTEGER NOT NULL CHECK (amount_cents >= 0),
  subtotal_cents         INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  discount_cents         INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  total_cents            INTEGER NOT NULL CHECK (total_cents >= 0),
  promotion_id           TEXT,
  customer_name          TEXT NOT NULL,
  customer_email         TEXT NOT NULL,
  customer_company       TEXT,
  customer_document_type TEXT,
  customer_document      TEXT,
  status                 TEXT NOT NULL DEFAULT 'created'
                         CHECK (status IN ('created', 'pending', 'approved', 'rejected', 'refunded')),
  utm_source             TEXT,
  utm_medium             TEXT,
  utm_campaign           TEXT,
  utm_content            TEXT,
  utm_term               TEXT,
  gclid                  TEXT,
  gbraid                 TEXT,
  wbraid                 TEXT,
  fbclid                 TEXT,
  landing_page           TEXT,
  referrer               TEXT,
  mp_payment_id          TEXT,
  transaction_id         TEXT,
  mp_status              TEXT,
  mp_status_detail       TEXT,
  mp_payment_method      TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_mp_payment_id ON orders (mp_payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
`
