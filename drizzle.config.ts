import type { Config } from 'drizzle-kit'
import { databaseUrl, dbFilePath, isPostgres, pgSchema } from './lib/db/config'

/**
 * Same schema, same dialect, either driver: Supabase in production, PGlite
 * (embedded Postgres) locally and in tests.
 */
export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  ...(isPostgres()
    ? { dbCredentials: { url: databaseUrl() } }
    : { driver: 'pglite' as const, dbCredentials: { url: dbFilePath() } }),
  schemaFilter: [pgSchema()],
} satisfies Config
