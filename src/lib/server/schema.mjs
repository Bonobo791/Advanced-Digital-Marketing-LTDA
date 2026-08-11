/**
 * SQLite schema for the pricing persistence layer (Turso / libSQL).
 *
 * Pricing is versioned and append-only: a price change deactivates the old
 * `prices` row (active = 0, effective_until set) and inserts a new one —
 * historical price rows are never mutated.
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
`
