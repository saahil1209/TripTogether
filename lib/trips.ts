import 'server-only'
import { and, asc, eq } from 'drizzle-orm'
import { db, participants, reactions, responses, tasks, trips } from '@/lib/db'
import type { ParticipantRow, ReactionRow, ResponseRow, TaskRow, TripRow } from '@/lib/db'
import { code, id } from '@/lib/ids'
import { recommend } from '@/lib/recommendations'
import type { Recommendation, TripOption } from '@/lib/recommendations'
import { type CreateTripInput, type DraftPreferences, preferencesSchema } from '@/lib/schemas'
import type { ParticipantResponse } from '@/lib/types'

export interface TripState {
  trip: TripRow
  participants: ParticipantRow[]
  responses: ResponseRow[]
  reactions: ReactionRow[]
  tasks: TaskRow[]
}

/* ------------------------------------------------------------------ reads */

export async function loadTrip(tripId: string): Promise<TripState | null> {
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1)
  if (!trip) return null
  const [people, answers, votes, todo] = await Promise.all([
    db.select().from(participants).where(eq(participants.tripId, tripId))
      .orderBy(asc(participants.position)),
    db.select().from(responses).where(eq(responses.tripId, tripId)),
    db.select().from(reactions).where(eq(reactions.tripId, tripId)),
    db.select().from(tasks).where(eq(tasks.tripId, tripId)).orderBy(asc(tasks.position)),
  ])

  return { trip, participants: people, responses: answers, reactions: votes, tasks: todo }
}

export async function loadTripByInvite(inviteCode: string): Promise<TripState | null> {
  const [trip] = await db.select().from(trips).where(eq(trips.inviteCode, inviteCode)).limit(1)
  return trip ? loadTrip(trip.id) : null
}

export async function loadTripByOrganizer(organizerCode: string): Promise<TripState | null> {
  const [trip] = await db.select().from(trips)
    .where(eq(trips.organizerCode, organizerCode)).limit(1)
  return trip ? loadTrip(trip.id) : null
}

/* ------------------------------------------------------------- derivation */

/** Only submitted responses count. A draft is not an answer. */
export function submittedResponses(state: TripState): ParticipantResponse[] {
  const byId = new Map(state.participants.map((p) => [p.id, p]))
  const out: ParticipantResponse[] = []
  for (const row of state.responses) {
    if (row.status !== 'submitted') continue
    const participant = byId.get(row.participantId)
    if (!participant) continue
    const parsed = preferencesSchema.safeParse(JSON.parse(row.data))
    if (!parsed.success) continue
    out.push({ participantId: participant.id, name: participant.name, preferences: parsed.data })
  }
  return out.sort(
    (a, b) =>
      (byId.get(a.participantId)?.position ?? 0) - (byId.get(b.participantId)?.position ?? 0),
  )
}

export function hasResponded(state: TripState, participantId: string): boolean {
  return state.responses.some((r) => r.participantId === participantId && r.status === 'submitted')
}

export function responseFor(state: TripState, participantId: string): ResponseRow | undefined {
  return state.responses.find((r) => r.participantId === participantId)
}

export function draftFor(state: TripState, participantId: string): DraftPreferences {
  const row = responseFor(state, participantId)
  if (!row) return {}
  try {
    return JSON.parse(row.data) as DraftPreferences
  } catch {
    return {}
  }
}

export function everyoneResponded(state: TripState): boolean {
  return state.participants.length > 0
    && state.participants.every((p) => hasResponded(state, p.id))
}

export function deadlinePassed(trip: TripRow): boolean {
  if (!trip.responseDeadline) return false
  return new Date().toISOString().slice(0, 10) > trip.responseDeadline
}

export function canPublish(state: TripState): boolean {
  return submittedResponses(state).length >= 2
    && (everyoneResponded(state) || deadlinePassed(state.trip))
}

export function missingNames(state: TripState): string[] {
  return state.participants.filter((p) => !hasResponded(state, p.id)).map((p) => p.name)
}

export function recommendationFor(state: TripState): Recommendation {
  return recommend({
    responses: submittedResponses(state),
    participantCount: state.participants.length,
    windowStart: state.trip.windowStart,
    windowEnd: state.trip.windowEnd,
    tripLengthDays: state.trip.tripLengthDays,
  })
}

/**
 * A locked decision is served from the snapshot taken at lock time. If the
 * destination data or someone's answers change afterwards, the decision the
 * group actually made is still the decision they see.
 */
export function lockedOption(state: TripState): TripOption | null {
  if (!state.trip.lockedSnapshot) return null
  try {
    return JSON.parse(state.trip.lockedSnapshot) as TripOption
  } catch {
    return null
  }
}

export function reactionsFor(state: TripState, optionId: string): ReactionRow[] {
  return state.reactions.filter((r) => r.optionId === optionId)
}

export function reactionsFrozen(state: TripState): boolean {
  if (state.trip.lockedAt) return true
  if (!state.trip.decisionDeadline) return false
  return new Date().toISOString().slice(0, 10) > state.trip.decisionDeadline
}

/* ----------------------------------------------------------------- writes */

export async function createTrip(input: CreateTripInput, isDemo = false): Promise<TripRow> {
  const tripId = id()
  const now = Date.now()
  const row: TripRow = {
    id: tripId,
    name: input.name,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    tripLengthDays: input.tripLengthDays,
    responseDeadline: input.responseDeadline,
    decisionDeadline: null,
    inviteCode: code(),
    organizerCode: code(),
    organizerParticipantId: null,
    publishedAt: null,
    lockedOptionId: null,
    lockedAt: null,
    lockedSnapshot: null,
    isDemo,
    createdAt: now,
  }
  await db.insert(trips).values(row)

  const people = input.participantNames.map((name, position) => ({
    id: id(), tripId, name, position,
  }))
  await db.insert(participants).values(people)

  // The first name on the list is the organizer by convention.
  const organizer = people[0]
  if (organizer) {
    await db.update(trips).set({ organizerParticipantId: organizer.id }).where(eq(trips.id, tripId))
    row.organizerParticipantId = organizer.id
  }
  return row
}

export async function saveDraft(
  tripId: string,
  participantId: string,
  patch: DraftPreferences,
  step: number,
): Promise<void> {
  const [existing] = await db.select().from(responses)
    .where(eq(responses.participantId, participantId)).limit(1)
  const now = Date.now()

  if (!existing) {
    await db.insert(responses).values({
      id: id(), tripId, participantId,
      status: 'draft', step, data: JSON.stringify(patch),
      deeperDone: false, submittedAt: null, updatedAt: now,
    })
    return
  }

  const merged = { ...(JSON.parse(existing.data) as DraftPreferences), ...patch }
  await db.update(responses)
    .set({ data: JSON.stringify(merged), step: Math.max(existing.step, step), updatedAt: now })
    .where(eq(responses.id, existing.id))
    
}

/** Returns validation problems rather than throwing, so the form can show them. */
export async function submitResponse(
  tripId: string,
  participantId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const [existing] = await db.select().from(responses)
    .where(eq(responses.participantId, participantId)).limit(1)
  if (!existing) return { ok: false, message: 'Nothing has been answered yet.' }

  const parsed = preferencesSchema.safeParse(JSON.parse(existing.data))
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Some answers are missing.' }
  }

  await db.update(responses)
    .set({ status: 'submitted', submittedAt: Date.now(), updatedAt: Date.now() })
    .where(eq(responses.id, existing.id))
    

  // Any change to the inputs invalidates a published result, so republishing is
  // an explicit act rather than something that happens silently underneath.
  return { ok: true }
}

export async function markDeeperDone(participantId: string): Promise<void> {
  await db.update(responses).set({ deeperDone: true, updatedAt: Date.now() })
    .where(eq(responses.participantId, participantId))
}

export async function publishResults(tripId: string): Promise<void> {
  await db.update(trips).set({ publishedAt: Date.now() }).where(eq(trips.id, tripId))
}

export async function setReaction(
  tripId: string,
  participantId: string,
  optionId: string,
  reaction: ReactionRow['reaction'],
): Promise<void> {
  const [existing] = await db.select().from(reactions)
    .where(and(eq(reactions.participantId, participantId), eq(reactions.optionId, optionId)))
    .limit(1)
  if (existing) {
    await db.update(reactions).set({ reaction, updatedAt: Date.now() })
      .where(eq(reactions.id, existing.id))
    return
  }
  await db.insert(reactions).values({
    id: id(), tripId, participantId, optionId, reaction, updatedAt: Date.now(),
  })
}

const DEFAULT_TASKS = [
  'Book the stay',
  'Book travel (and share the booking links)',
  'Plan what we actually do',
  'Collect the money',
  'Make the packing / essentials list',
]

export async function lockDecision(
  tripId: string,
  option: TripOption,
  people: ParticipantRow[],
): Promise<void> {
  await db.update(trips)
    .set({
      lockedOptionId: option.id,
      lockedAt: Date.now(),
      lockedSnapshot: JSON.stringify(option),
    })
    .where(eq(trips.id, tripId))
    

  const existing = await db.select().from(tasks).where(eq(tasks.tripId, tripId))
  if (existing.length === 0 && people.length > 0) {
    await db.insert(tasks).values(
      DEFAULT_TASKS.map((label, position) => ({
        id: id(),
        tripId,
        label,
        ownerParticipantId: people[position % people.length]!.id,
        done: false,
        position,
      })),
    )
  }
}

export async function unlockDecision(tripId: string): Promise<void> {
  await db.update(trips)
    .set({ lockedOptionId: null, lockedAt: null, lockedSnapshot: null })
    .where(eq(trips.id, tripId))
    
}

export async function setTaskOwner(taskId: string, ownerParticipantId: string | null): Promise<void> {
  await db.update(tasks).set({ ownerParticipantId }).where(eq(tasks.id, taskId))
}

export async function setTaskDone(taskId: string, done: boolean): Promise<void> {
  await db.update(tasks).set({ done }).where(eq(tasks.id, taskId))
}

export async function setDecisionDeadline(tripId: string, date: string | null): Promise<void> {
  await db.update(trips).set({ decisionDeadline: date }).where(eq(trips.id, tripId))
}

export async function removeParticipant(participantId: string): Promise<void> {
  // Recalculation is automatic: every result is derived from the responses that
  // still exist, never cached. Their response, reactions and draft go with them.
  await db.delete(participants).where(eq(participants.id, participantId))
}

export async function addParticipant(tripId: string, name: string): Promise<ParticipantRow> {
  const existing = await db.select().from(participants).where(eq(participants.tripId, tripId))
  const row: ParticipantRow = {
    id: id(),
    tripId,
    name,
    position: existing.reduce((max, p) => Math.max(max, p.position), -1) + 1,
  }
  await db.insert(participants).values(row)
  return row
}

export async function renameParticipant(participantId: string, name: string): Promise<void> {
  await db.update(participants).set({ name }).where(eq(participants.id, participantId))
}

export interface TripSettings {
  name: string
  windowStart: string
  windowEnd: string
  tripLengthDays: number
  responseDeadline: string | null
  decisionDeadline: string | null
}

export async function updateTripSettings(tripId: string, settings: TripSettings): Promise<void> {
  await db.update(trips).set(settings).where(eq(trips.id, tripId))
}

/**
 * Pulling results back from the group. Used when the trip changes underneath a
 * published result: the group should not keep looking at a page that no longer
 * describes the trip they are in.
 */
export async function unpublishResults(tripId: string): Promise<void> {
  await db.update(trips).set({ publishedAt: null }).where(eq(trips.id, tripId))
}

/**
 * Widening the window adds days that everyone who already answered never saw.
 * Their availability there is an assumption, not an answer, so the organizer is
 * told rather than left to find out from a wrong recommendation.
 */
export function widensWindow(trip: TripRow, settings: TripSettings): boolean {
  return settings.windowStart < trip.windowStart || settings.windowEnd > trip.windowEnd
}

export function settingsChanged(trip: TripRow, settings: TripSettings): boolean {
  return (
    trip.name !== settings.name
    || trip.windowStart !== settings.windowStart
    || trip.windowEnd !== settings.windowEnd
    || trip.tripLengthDays !== settings.tripLengthDays
    || trip.responseDeadline !== settings.responseDeadline
    || trip.decisionDeadline !== settings.decisionDeadline
  )
}

/** Changes that alter what the engine computes, as opposed to cosmetic ones. */
export function affectsRecommendation(trip: TripRow, settings: TripSettings): boolean {
  return (
    trip.windowStart !== settings.windowStart
    || trip.windowEnd !== settings.windowEnd
    || trip.tripLengthDays !== settings.tripLengthDays
  )
}
