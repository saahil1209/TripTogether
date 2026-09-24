# Deploying TripTogether

The database is already set up. What's left is pointing the app at it and putting
the app somewhere the group can reach.

---

## What already exists

**Supabase project:** `saahil1209's Project` (`bcmdgasjjdfwplcwilvb`), region
`ap-southeast-2`.

The five tables live in a dedicated **`triptogether` schema**, not `public`:

```
triptogether.trips
triptogether.participants
triptogether.responses
triptogether.reactions
triptogether.tasks
```

Nothing in `public` was touched — `voice_skill`, `notes` and `drafts` are exactly
as they were. To remove this app from the project entirely, one statement does it:

```sql
DROP SCHEMA triptogether CASCADE;
```

Row-level security is **enabled with no policies** on all five tables. That is
deliberate: the app connects over Postgres as the owner, which bypasses RLS, and
the `triptogether` schema is not in Supabase's exposed-schemas list, so PostgREST
can't reach it. If it were ever exposed, an anon key would still read nothing.
Supabase's linter will flag "RLS enabled, no policy" as INFO — that's this, and
it's correct.

---

## Step 1 — get the connection string

In the Supabase dashboard: **Project Settings → Database → Connection string**.

Pick **Transaction pooler** (port 6543) for Vercel — serverless functions open
and close connections constantly, which is exactly what the transaction pooler is
for. The direct connection (port 5432) will exhaust its connection limit.

It looks like this, with your own password substituted for the placeholder:

```
postgresql://postgres.bcmdgasjjdfwplcwilvb:YOUR-PASSWORD@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres
```

Prepared statements are already disabled in `lib/db/index.ts`, which is what the
transaction pooler requires.

> Put your database password in yourself. Don't paste it into a chat, a commit,
> or an issue. If you've lost it, reset it under Database → Reset database password.

## Step 2 — generate a signing secret

This signs the cookie that says which participant a browser is. Anyone who knows
it can forge an identity on any trip.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

The app **refuses to start in production without it** rather than falling back to
a predictable key.

## Step 3 — try it locally against Supabase first

Before deploying, confirm the app talks to the real database:

```bash
cp .env.example .env.local
./scripts/set-db-password.sh   # prompts for the connection string, nothing echoed
npm run db:seed                # creates the two demo trips in Supabase
npx next dev                   # not `npm run dev`, which would re-push the schema
```

`set-db-password.sh` takes either a whole connection string or a bare password,
percent-encodes characters like `#` and `@` that would otherwise break the URL,
and refuses the `[YOUR-PASSWORD]` placeholder rather than saving something broken.
Paste at its `>` prompt, not at the shell prompt.

Note that `db:seed` and `db:push` load `.env.local` explicitly via
`--env-file-if-exists`. Next.js reads it automatically; standalone CLI scripts do
not, and without it they would quietly write to the local database instead.

If the demo trips load, the wiring is correct.

To go back to local-only, delete `DATABASE_URL` from `.env.local`. The app falls
back to PGlite and never touches Supabase.

## Step 4 — deploy to Vercel

```bash
npx vercel
```

The first run asks you to log in and link the project — that part needs you; it's
an OAuth flow.

Then set the two environment variables, either in the dashboard under
**Settings → Environment Variables** or from the CLI:

```bash
npx vercel env add DATABASE_URL production
npx vercel env add TRIPTOGETHER_SECRET production
```

And ship it:

```bash
npx vercel --prod
```

No `vercel.json` is needed — Next.js is detected automatically and `npm run build`
is the right build command. Note that `npm run dev` pushes the schema before
starting, which is why the build script is plain `next build`: a deploy should
never silently migrate your database.

---

## Schema changes later

`npm run db:push` applies the current schema to whatever `DATABASE_URL` points at.
Against Supabase, prefer generating a migration and reviewing the SQL first:

```bash
npx drizzle-kit generate --name=what_changed   # writes drizzle/NNNN_*.sql
# read it, then:
DATABASE_URL="postgresql://…" npx drizzle-kit migrate
```

The generated SQL for the initial schema is in `drizzle/0000_initial_schema.sql`,
which is what was applied to Supabase.

---

## A note on scale

The recommendation engine recomputes from scratch on every page view. For a group
of five and 17 destinations that's about 50 candidates and sub-millisecond work,
so there is no cache and nothing to invalidate — which is why editing an answer
is instantly reflected everywhere.

That stays true for the sizes this product is for. If you ever pointed it at
hundreds of destinations or twenty-person groups, candidate generation is the
thing that would need attention first, not the database.
