/**
 * Seed data: the five initial products and their current (one-time) prices.
 *
 * Idempotent (INSERT OR IGNORE) — safe to run on every cold start. Price
 * changes are append-only: never UPDATE a seeded price row; insert a new
 * `prices` row and deactivate the old one instead.
 */
export const SEED_SQL = `
INSERT OR IGNORE INTO products (id, slug, name, description, active, created_at, updated_at) VALUES
  ('google-ads-management', 'google-ads-management', 'Google Ads Management', 'Paid search campaigns that buy revenue, not clicks.', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('meta-ads-management', 'meta-ads-management', 'Meta Ads Management', 'Creative-tested campaigns on Meta, Instagram and LinkedIn.', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('seo', 'seo', 'SEO & GEO', 'Rank in Google and get cited by the AI answer engines.', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('website-development', 'website-development', 'Website Development', 'Sites built to rank, convert and load fast.', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('consulting', 'consulting', 'Consulting', 'Strategy sessions to map your next move.', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO prices (id, product_id, currency, amount_cents, billing_type, interval, active, effective_from, effective_until, created_at) VALUES
  ('price_google_ads_2026_08', 'google-ads-management', 'BRL', 250000, 'one_time', NULL, 1, '2026-01-01T00:00:00.000Z', NULL, '2026-01-01T00:00:00.000Z'),
  ('price_meta_ads_2026_08', 'meta-ads-management', 'BRL', 250000, 'one_time', NULL, 1, '2026-01-01T00:00:00.000Z', NULL, '2026-01-01T00:00:00.000Z'),
  ('price_seo_2026_08', 'seo', 'BRL', 390000, 'one_time', NULL, 1, '2026-01-01T00:00:00.000Z', NULL, '2026-01-01T00:00:00.000Z'),
  ('price_website_development_2026_08', 'website-development', 'BRL', 590000, 'one_time', NULL, 1, '2026-01-01T00:00:00.000Z', NULL, '2026-01-01T00:00:00.000Z'),
  ('price_consulting_2026_08', 'consulting', 'BRL', 150000, 'one_time', NULL, 1, '2026-01-01T00:00:00.000Z', NULL, '2026-01-01T00:00:00.000Z');
`
