/**
 * Kept dependency-free so drizzle-kit can import it directly.
 *
 * Two backends, chosen by DATABASE_URL:
 *   file:./triptogether.db   SQLite. Zero setup — `npm install && npm run dev`.
 *   postgres://… | postgresql://…   Postgres, e.g. Supabase. What deploys.
 *
 * Nothing above this file knows which is in use: the schema is written once in
 * dialect-neutral Drizzle, and lib/db/index.ts picks the driver.
 */

export type Dialect = 'sqlite' | 'postgres'

export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? 'file:./triptogether.db'
}

export function dialect(): Dialect {
  return databaseUrl().startsWith('postgres') ? 'postgres' : 'sqlite'
}

export function isPostgres(): boolean {
  return dialect() === 'postgres'
}

/** The Postgres schema this app owns. Everything it creates lives in here. */
export function pgSchema(): string {
  return process.env.DATABASE_SCHEMA ?? 'triptogether'
}

export function dbFilePath(): string {
  const url = databaseUrl()
  return url.startsWith('file:') ? url.slice('file:'.length) : url
}

/** Kept for drizzle.config.ts and anything still expecting the old name. */
export function dbFileUrl(): string {
  return databaseUrl()
}
