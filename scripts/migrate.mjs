#!/usr/bin/env node
/**
 * Applies the schema and seed data to the configured Turso database.
 *
 *   npm run db:migrate
 *
 * Reads TURSO_DATABASE_URL / TURSO_AUTH_TOKEN from the environment, falling
 * back to `.env.local` then `.env` (same precedence as SvelteKit: shell env
 * wins, `.env.local` overrides `.env`). The application also applies schema +
 * seed idempotently on cold start (`src/lib/server/db.ts`); this script
 * exists for explicit migrations. Plain `.mjs` imports keep the script
 * runnable on any Node version — no TS type-stripping required.
 */
import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@libsql/client'
import { SCHEMA_SQL } from '../src/lib/server/schema.mjs'
import { SEED_SQL } from '../src/lib/server/seed.mjs'

/** Loads a dotenv-style file without overriding variables already in the environment. */
function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && !(key in process.env)) process.env[key] = value
  }
}

// Highest precedence first: shell env > .env.local > .env.
loadEnvFile('.env.local')
loadEnvFile('.env')

const url = process.env.TURSO_DATABASE_URL

if (!url) {
  console.error('TURSO_DATABASE_URL is not set — nothing to migrate.')
  process.exit(1)
}

const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
})

try {
  await client.executeMultiple(SCHEMA_SQL)
  await client.executeMultiple(SEED_SQL)
  console.log(`Schema and seed applied to ${url}`)
} finally {
  client.close()
}
