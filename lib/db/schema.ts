import {
  bigint, boolean, index, integer, pgSchema as definePgSchema, text, uniqueIndex,
} from 'drizzle-orm/pg-core'
import { pgSchema } from './config'

/**
 * Postgres everywhere: Supabase in production, PGlite (embedded Postgres) for
 * local development and tests. One dialect means the SQL that runs in the test
 * suite is the SQL that runs in production.
 *
 * Everything this app owns lives inside its own schema, so it can be added to a
 * database that already has other things in it — and removed again with a
 * single DROP SCHEMA.
 */
export const app = definePgSchema(pgSchema())

/** Unix milliseconds. Stored as bigint so it survives 2038 and stays an integer. */
const millis = (name: string) => bigint(name, { mode: 'number' })

export const trips = app.table('trips', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** The rough window the organizer set, e.g. all of October. */
  windowStart: text('window_start').notNull(),
  windowEnd: text('window_end').notNull(),
  tripLengthDays: integer('trip_length_days').notNull(),
  responseDeadline: text('response_deadline'),
  decisionDeadline: text('decision_deadline'),
  /** Unguessable. Everything group-facing is reached through this. */
  inviteCode: text('invite_code').notNull(),
  /** Separate and private: the organizer's link, never shared with the group. */
  organizerCode: text('organizer_code').notNull(),
  organizerParticipantId: text('organizer_participant_id'),
  publishedAt: millis('published_at'),
  lockedOptionId: text('locked_option_id'),
  lockedAt: millis('locked_at'),
  /** The option exactly as it was when it was locked, so a later data change
   *  cannot silently rewrite a decision the group already made. */
  lockedSnapshot: text('locked_snapshot'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: millis('created_at').notNull(),
}, (t) => [
  uniqueIndex('trips_invite_code_idx').on(t.inviteCode),
  uniqueIndex('trips_organizer_code_idx').on(t.organizerCode),
])

export const participants = app.table('participants', {
  id: text('id').primaryKey(),
  tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').notNull(),
}, (t) => [index('participants_trip_idx').on(t.tripId)])

export const responses = app.table('responses', {
  id: text('id').primaryKey(),
  tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  participantId: text('participant_id').notNull()
    .references(() => participants.id, { onDelete: 'cascade' }),
  /** 'draft' until the core pass is submitted. Only 'submitted' counts. */
  status: text('status', { enum: ['draft', 'submitted'] }).notNull().default('draft'),
  /** Furthest step reached, so a refresh resumes where they left off. */
  step: integer('step').notNull().default(0),
  /** Partial Preferences as JSON: a draft is legitimately incomplete, so it is
   *  validated on submit rather than forced into columns that cannot hold it. */
  data: text('data').notNull().default('{}'),
  deeperDone: boolean('deeper_done').notNull().default(false),
  submittedAt: millis('submitted_at'),
  updatedAt: millis('updated_at').notNull(),
}, (t) => [uniqueIndex('responses_participant_idx').on(t.participantId)])

export const reactions = app.table('reactions', {
  id: text('id').primaryKey(),
  tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  participantId: text('participant_id').notNull()
    .references(() => participants.id, { onDelete: 'cascade' }),
  optionId: text('option_id').notNull(),
  reaction: text('reaction', { enum: ['love', 'happy', 'could', 'no'] }).notNull(),
  updatedAt: millis('updated_at').notNull(),
}, (t) => [uniqueIndex('reactions_unique_idx').on(t.participantId, t.optionId)])

export const tasks = app.table('tasks', {
  id: text('id').primaryKey(),
  tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  ownerParticipantId: text('owner_participant_id'),
  done: boolean('done').notNull().default(false),
  position: integer('position').notNull(),
}, (t) => [index('tasks_trip_idx').on(t.tripId)])

export type TripRow = typeof trips.$inferSelect
export type ParticipantRow = typeof participants.$inferSelect
export type ResponseRow = typeof responses.$inferSelect
export type ReactionRow = typeof reactions.$inferSelect
export type TaskRow = typeof tasks.$inferSelect
