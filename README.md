# TripTogether

A group decision tool for travel. It turns five individual preference forms into
shared constraints, one to three genuinely viable options, and one locked decision.

It is not a travel planner and not a booking site. It compresses the conversation
that normally eats three months of group chat into a single decision.

---

## Running it

Requires Node 20 or newer. Nothing else — no accounts, no API keys, no Docker,
no database server.

```bash
npm install && npm run dev
```

Then open <http://localhost:3000>. `npm run dev` creates the local database on
first run.

That database is **PGlite** — Postgres compiled to WASM, running in-process and
persisted to `./triptogether.db/`. It speaks the same SQL as the Supabase
Postgres this deploys to, so the tests exercise exactly what production runs.
Point `DATABASE_URL` at a real Postgres to switch; see [DEPLOY.md](DEPLOY.md).

### Loading the demo

Either press **Load demo trip** on the landing page, or:

```bash
npm run db:seed
```

Both create two trips with the five friends from the brief:

1. **Goa? Gokarna? Somewhere.** — all five have responded.
2. **The one we keep not booking** — only three of five have responded, to show
   the partial state and the organizer-only early picture.

The seed script prints an organizer link and a group link for each. The button
drops you straight on the first trip's organizer dashboard.

To walk the whole journey yourself: open the organizer link, copy the group link,
open it in another browser or a private window, pick a different name, and fill in
the form. Use **Not \<name\>?** on the join screen to switch identity in one browser.

### Other commands

```bash
npm test          # unit tests: the engine and access control
npm run test:e2e  # end-to-end: the whole journey in a real browser
npm run test:all  # both
npm run typecheck # tsc --noEmit
npm run build     # production build
npm run db:push   # apply the schema to whatever DATABASE_URL points at
```

---

## How it is put together

```
app/                      Next.js App Router pages + server actions
  page.tsx                Landing
  trip/new/               Create a trip
  join/[code]/            Name pick, preference flow, submitted state
  trip/[code]/organizer/  Organizer dashboard (keyed by the private organizer code)
                          — participation, early picture, trip settings, publish
  trip/[code]/results/    Group results (keyed by the shared invite code)
  trip/[code]/decide/     Reactions, lock, locked state
  actions.ts              Every mutation, with its access check

lib/
  recommendations/        The engine. Pure TypeScript, no React, no LLM.
    constraints.ts        Hard filters: routes, stay tiers, date windows
    scoring.ts            Per-person fit; group coverage and severity
    candidates.ts         Candidate generation; smallest-compromise search
    explain.ts            Template explanations, "why not", boundaries, fairness
    index.ts              Orchestration and role selection
  destinations/           17 curated Indian destinations behind a swappable interface
  demo/                   The seeded scenario, shared by the seed script and the tests
  db/                     Drizzle schema and connection (PGlite or Postgres)
  types.ts                The preference model
  schemas.ts              Zod schemas shared by client and server
  auth.ts                 Signed participant tokens

tests/                    Vitest: 38 tests across the engine and access control
e2e/                      Playwright: the full journey, in a real browser
drizzle/                  Generated SQL migrations
```

### The preference model

Every input is classified into exactly one tier, and the tiers never mix:

| Tier | Fields | Effect |
|---|---|---|
| **Hard constraint** | can't-go dates, maximum budget, deal-breakers | A violation is a **Conflict**. Nothing can outweigh it. |
| **Strong preference** | top vibe, comfortable budget, preferred dates, pace | Can produce a **Compromise**. |
| **Nice to have** | secondary vibes, accommodation style, lesser priorities | Reported, but never demotes a fit. |

### How an option is built

```
responses → normalise → hard-constraint filter (dates, max budget incl. travel, deal-breakers)
  → feasible date windows → candidates (destination × window × stay tier)
  → per-person fit → group scoring → conflicts → smallest compromise
  → 1–3 options → explanations
```

Group scoring is deliberately **not** an average. Coverage (how many people are a
strong or good fit) and compromise severity are scored separately, so four delighted
people cannot smooth over one person in deep compromise. Numeric scores order the
candidates; they never replace the per-person status, which is always shown.

### Never padded

Three roles exist — **Best overall fit**, **Lowest friction**, **Different vibe** —
and each of the latter two has to earn its slot:

- *Lowest friction* appears only if it has strictly fewer compromises than the best option.
- *Different vibe* appears only if it has a different dominant vibe **and** serves
  someone's top preference that no other shown option can serve.

On the seeded scenario this yields **two** options, not three. That is the engine
working, not failing.

### Access control

- Invite and organizer codes are 12 characters from a CSPRNG over a 28-symbol
  alphabet (~2^57). The organizer link is separate from the group link and is never
  rendered on a group-facing page.
- Participants are identified by an HMAC-signed cookie scoped to one trip. The token
  carries an identity and nothing else; it cannot be edited into someone else's.
- The organizer code is the credential for publishing, locking and unlocking. Every
  server action re-checks it — none of them trust anything the client sends.

---

## Decisions that differ from the brief

**The engine does not pick Goa.** On the seeded scenario it picks **Gokarna**, with
Rishikesh as the different-vibe option, and explains Goa under "Why not". This is the
engine doing what it was asked to: Karan's ₹20k comfortable budget makes Goa pinch,
and Gokarna delivers the same beach for less, so Goa ends up with two compromises
where Gokarna has none. The brief anticipated this ("it must not just declare Goa
wins"); I let the result stand rather than tuning the data until Goa won.

**"Why not X?" also covers viable options.** The brief describes it for excluded
candidates. A viable, well-known destination that simply lost on fit — Goa here —
would otherwise vanish silently, which is exactly how a tool loses trust. So the
section handles both cases with different copy.

**Two additions to the destination model.** `idealDays` (the shortest and longest
trip a place is worth) and a season rating, because without them the engine happily
proposed flying five people from five cities to Alibaug — a Mumbai weekend spot — for
four days. The trip-length mismatch is weighted more heavily the further someone is
travelling.

**Route choice is budget-aware.** Among routes a person's deal-breakers allow, the
engine values an hour of travel as a fraction of their comfortable budget, with an
extra penalty for overnight journeys. Someone with room to spare flies; someone at
their ceiling takes the bus. If the preferred route would break their maximum budget,
it falls back to the cheapest legal one before declaring a conflict.

**Calendar defaults to "can go".** The brief specifies three states. Rather than make
everyone paint 31 green days, every day starts as *can go* and people mark what they
can't. Same data, far less tapping — and it makes "can't go" the deliberate act it
should be.

**shadcn/ui components are hand-written.** The `shadcn` CLI needs an interactive
terminal this environment doesn't have. The primitives follow the same conventions
(`cva` + `tailwind-merge`, `asChild` via Radix Slot) and Radix is used where
accessibility genuinely needs it — the lock confirmation dialog.

**Draft preferences are stored as JSON.** A half-finished form is legitimately
incomplete, so drafts are stored as a JSON blob and validated with the shared Zod
schema on submit, rather than forced into columns that would have to be nullable
anyway. Submitted responses are re-validated on every read.

**A locked decision is stored as a snapshot.** Once locked, the trip is served from
the option exactly as it was at lock time. Later edits to someone's answers — or to
the destination data — cannot silently rewrite a decision the group already made.

**Added: identity switching.** Not in the brief, but a shared phone or a mistyped tap
otherwise traps someone as the wrong person forever. **Not \<name\>?** clears the cookie.

**Added: the app refuses to run in production without a signing secret.** It falls
back to a known development key otherwise, which would let anyone forge an
identity on any trip.

**No LLM anywhere.** All explanation copy is template-generated from the deterministic
output. The optional LLM rephrasing wrapper the brief allowed was not built — it would
have been a switched-off code path with nothing to show for it.

**Postgres everywhere, via PGlite.** The brief asked for SQLite locally with a
swappable path to Postgres. Keeping both dialects would have meant two Drizzle
schemas that could silently drift, so local development and the test suite run on
PGlite — Postgres in WASM, in-process, no server or account — and production runs
on Supabase. One schema, one dialect, and the tests exercise the SQL that actually
deploys. `npm install && npm run dev` still works with nothing installed.

**Organizer edit controls.** The brief listed "participant removed" and "trip
parameters changed" as edge cases. The recalculation always worked — nothing is
cached, every result derives from current responses — but there was no way to
*trigger* it. The organizer can now change the name, window, length and both
deadlines, and add, rename or remove people. Two consequences are handled
explicitly rather than silently: a change that alters what the engine computes
**pulls published results back**, because they would otherwise describe a trip
that no longer exists; and a locked decision **refuses to be edited at all** until
it is unlocked.

**The decision deadline is now reachable.** It had a column, an action and
freeze logic, but nothing to set it. Without it, "reactions freeze at the
deadline" could only ever happen via the lock.

---

## Testing

```bash
npm run test:all
```

**38 unit tests** (Vitest). The engine suite asserts the seeded scenario's
reasoning directly: 19–22 Oct is the only workable window, ₹25,000 is the binding
ceiling, mid-range is the only viable stay tier, nobody is ever shown an option
above their own maximum, Goa is addressed rather than dropped, and group-facing
copy never names a person.

Edge cases covered: one response and zero responses, no date overlap (with and
without a workable shorter trip), no budget overlap, everything rejected,
deal-breakers that must never be averaged away, a hard constraint beating a
perfect preference match, the smallest-compromise search, the fairness flag, and
determinism across runs.

`tests/auth.test.ts` covers the signed participant token — cross-trip replay,
identity swapping, signature tampering, malformed input — and that the app
refuses to fall back to a predictable signing key in production.

**3 end-to-end tests** (Playwright) drive a real browser through the whole
journey: create a trip, three people join in separate browser contexts and answer
independently, autosave and resume mid-form, the no-anchoring rule holds before
publication, results and the alignment matrix render, people react, a participant
cannot lock, the organizer locks with confirmation, and reactions freeze
afterwards. Plus invalid links and a phone-width layout check.

The e2e run gets its own database and its own port, so it can never touch your
dev data.

### What the e2e suite caught immediately

The first time it ran, it found a real bug I'd shipped: **the participant name
fields never rendered on the create-trip form.** `useFieldArray` doesn't track
arrays of primitive strings, so the list came back empty. I'd only ever created
trips through the demo seeder, so I had never seen it. The form now uses the
object-array shape react-hook-form actually supports.

That is the argument for the suite in one paragraph.
