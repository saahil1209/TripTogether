import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { databaseUrl, dbFilePath, isPostgres } from './config'
import * as schema from './schema'

/**
 * One dialect, two drivers.
 *
 *   postgres://…   Supabase (or any Postgres), via postgres-js.
 *   anything else  PGlite: Postgres compiled to WASM, running in-process and
 *                  persisted to a folder. No server, no account, no setup.
 *
 * Both speak the same SQL, so what the tests exercise is what production runs.
 */
type Db =
  | ReturnType<typeof drizzlePglite<typeof schema>>
  | ReturnType<typeof drizzlePostgres<typeof schema>>

/** Survives Next's dev-server module reloads, which would otherwise open a new
 *  connection on every hot update. */
const globalForDb = globalThis as unknown as { __triptogetherDb?: Db }

function connect(): Db {
  if (isPostgres()) {
    // Supabase's transaction pooler does not support prepared statements, so
    // they are disabled here and the app works through either connection string.
    const client = postgres(databaseUrl(), { prepare: false })
    return drizzlePostgres(client, { schema })
  }
  return drizzlePglite(dbFilePath(), { schema })
}

function getDb(): Db {
  if (!globalForDb.__triptogetherDb) globalForDb.__triptogetherDb = connect()
  return globalForDb.__triptogetherDb
}

export const db: Db = new Proxy({} as Db, {
  get: (_target, prop) => Reflect.get(getDb() as object, prop, getDb()),
}) as Db

/**
 * Releases the connection. Long-running servers never need this, but a script
 * does: both drivers hold the event loop open, so the process would not exit.
 */
export async function closeDb(): Promise<void> {
  const current = globalForDb.__triptogetherDb
  if (!current) return
  globalForDb.__triptogetherDb = undefined
  const client = (current as unknown as { $client?: { end?: () => Promise<void>; close?: () => Promise<void> } }).$client
  await client?.end?.()
  await client?.close?.()
}

export { schema }
export * from './schema'
