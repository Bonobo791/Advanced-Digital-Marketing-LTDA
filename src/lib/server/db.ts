/**
 * Turso (libSQL) database access.
 *
 * `getDb()` lazily creates a single client per process (per serverless warm
 * instance), applies the schema and seed idempotently, and throws a clear
 * error when `TURSO_DATABASE_URL` is not configured — mirroring the
 * cron-secret pattern.
 */
import { createClient, type Client } from '@libsql/client'
import { SCHEMA_SQL } from './schema.mjs'
import { SEED_SQL } from './seed.mjs'

let cached: Client | undefined

export async function getDb(): Promise<Client> {
  const url = process.env.TURSO_DATABASE_URL
  if (!url) {
    throw new Error('TURSO_DATABASE_URL is not configured')
  }
  if (!cached) {
    const client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    })
    await client.executeMultiple(SCHEMA_SQL)
    await client.executeMultiple(SEED_SQL)
    cached = client
  }
  return cached
}

/** Test hook: drop the cached client so the next getDb() starts fresh. */
export function resetDbCache(): void {
  cached = undefined
}
