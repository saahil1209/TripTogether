'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { seedDemo } from '@/lib/demo/seed'
import { recommendationFor } from '@/lib/trips'
import {
  createTripSchema, draftPreferencesSchema, participantNameSchema, reactionSchema,
  tripSettingsSchema,
} from '@/lib/schemas'

import { currentParticipantId, signInAs, signOutOf } from '@/lib/session'
import {
  addParticipant, affectsRecommendation, canPublish, createTrip, loadTripByInvite,
  loadTripByOrganizer, lockDecision, markDeeperDone, publishResults, reactionsFrozen,
  removeParticipant, renameParticipant, saveDraft, setDecisionDeadline, setReaction,
  setTaskDone, setTaskOwner, submitResponse, unlockDecision, unpublishResults,
  updateTripSettings, widensWindow,
} from '@/lib/trips'

export interface ActionResult {
  ok: boolean
  message?: string
  fieldErrors?: Record<string, string>
}

/* ----------------------------------------------------------------- create */

export async function createTripAction(raw: unknown): Promise<ActionResult> {
  const parsed = createTripSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { ok: false, message: parsed.error.issues[0]?.message, fieldErrors }
  }

  const trip = await createTrip(parsed.data)
  // The organizer is the first name on the list, so they never have to identify
  // themselves through the participant flow.
  if (trip.organizerParticipantId) await signInAs(trip.id, trip.organizerParticipantId)
  redirect(`/trip/${trip.organizerCode}/organizer?new=1`)
}

export async function loadDemoAction(): Promise<never> {
  const demo = await seedDemo()
  redirect(`/trip/${demo.complete.organizerCode}/organizer?demo=1`)
}

/* ------------------------------------------------------------ participant */

export async function identifyAction(inviteCode: string, participantId: string): Promise<ActionResult> {
  const state = await loadTripByInvite(inviteCode)
  if (!state) return { ok: false, message: 'That link is not valid.' }
  if (!state.participants.some((p) => p.id === participantId)) {
    return { ok: false, message: 'That person is not on this trip.' }
  }
  await signInAs(state.trip.id, participantId)
  revalidatePath(`/join/${inviteCode}`)
  return { ok: true }
}

/** Wrong name tapped, or a shared phone. Clears the identity, nothing else. */
export async function switchParticipantAction(inviteCode: string): Promise<ActionResult> {
  const state = await loadTripByInvite(inviteCode)
  if (!state) return { ok: false, message: 'That link is not valid.' }
  await signOutOf(state.trip.id)
  revalidatePath(`/join/${inviteCode}`)
  return { ok: true }
}

async function requireParticipant(inviteCode: string) {
  const state = await loadTripByInvite(inviteCode)
  if (!state) return { error: 'That link is not valid.' as const }
  const participantId = await currentParticipantId(state.trip.id)
  if (!participantId) return { error: 'Pick your name again to continue.' as const }
  if (!state.participants.some((p) => p.id === participantId)) {
    return { error: 'You are no longer on this trip.' as const }
  }
  return { state, participantId }
}

export async function saveDraftAction(
  inviteCode: string,
  patch: unknown,
  step: number,
): Promise<ActionResult> {
  const ctx = await requireParticipant(inviteCode)
  if ('error' in ctx) return { ok: false, message: ctx.error }

  const parsed = draftPreferencesSchema.safeParse(patch)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'That answer could not be saved.' }
  }
  await saveDraft(ctx.state.trip.id, ctx.participantId, parsed.data, step)
  return { ok: true }
}

export async function submitResponseAction(inviteCode: string): Promise<ActionResult> {
  const ctx = await requireParticipant(inviteCode)
  if ('error' in ctx) return { ok: false, message: ctx.error }

  const result = await submitResponse(ctx.state.trip.id, ctx.participantId)
  if (!result.ok) return { ok: false, message: result.message }

  revalidatePath(`/join/${inviteCode}`)
  return { ok: true }
}

export async function saveDeeperAction(inviteCode: string, patch: unknown): Promise<ActionResult> {
  const ctx = await requireParticipant(inviteCode)
  if ('error' in ctx) return { ok: false, message: ctx.error }

  const parsed = draftPreferencesSchema.safeParse(patch)
  if (!parsed.success) return { ok: false, message: 'Those answers could not be saved.' }

  await saveDraft(ctx.state.trip.id, ctx.participantId, parsed.data, 7)
  await markDeeperDone(ctx.participantId)
  revalidatePath(`/join/${inviteCode}`)
  return { ok: true }
}

export async function reactAction(
  inviteCode: string,
  optionId: string,
  reaction: unknown,
): Promise<ActionResult> {
  const ctx = await requireParticipant(inviteCode)
  if ('error' in ctx) return { ok: false, message: ctx.error }
  if (reactionsFrozen(ctx.state)) {
    return { ok: false, message: 'Reactions are closed — the decision is locked.' }
  }

  const parsed = reactionSchema.safeParse(reaction)
  if (!parsed.success) return { ok: false, message: 'That reaction is not valid.' }

  await setReaction(ctx.state.trip.id, ctx.participantId, optionId, parsed.data)
  revalidatePath(`/trip/${inviteCode}/decide`)
  return { ok: true }
}

/* -------------------------------------------------------------- organizer */

/** The organizer code is the credential: holding it is what authorises these. */
async function requireOrganizer(organizerCode: string) {
  const state = await loadTripByOrganizer(organizerCode)
  if (!state) return { error: 'That organizer link is not valid.' as const }
  return { state }
}

export async function publishResultsAction(organizerCode: string): Promise<ActionResult> {
  const ctx = await requireOrganizer(organizerCode)
  if ('error' in ctx) return { ok: false, message: ctx.error }
  if (!canPublish(ctx.state)) {
    return { ok: false, message: 'Not everyone has responded and the deadline has not passed yet.' }
  }

  await publishResults(ctx.state.trip.id)
  revalidatePath(`/trip/${organizerCode}/organizer`)
  revalidatePath(`/trip/${ctx.state.trip.inviteCode}/results`)
  return { ok: true }
}

export async function setDecisionDeadlineAction(
  organizerCode: string,
  date: string | null,
): Promise<ActionResult> {
  const ctx = await requireOrganizer(organizerCode)
  if ('error' in ctx) return { ok: false, message: ctx.error }
  await setDecisionDeadline(ctx.state.trip.id, date || null)
  revalidatePath(`/trip/${organizerCode}/organizer`)
  revalidatePath(`/trip/${ctx.state.trip.inviteCode}/decide`)
  return { ok: true }
}

export interface TripSettingsResult extends ActionResult {
  /** Set when a change invalidated results the group was already looking at. */
  unpublished?: boolean
  /** Set when the window grew past what people have actually answered for. */
  widened?: boolean
}

export async function updateTripSettingsAction(
  organizerCode: string,
  raw: unknown,
): Promise<TripSettingsResult> {
  const ctx = await requireOrganizer(organizerCode)
  if ('error' in ctx) return { ok: false, message: ctx.error }

  // A locked decision is a decision. Changing the trip under it has to be a
  // deliberate reopening, not a side effect of editing a date.
  if (ctx.state.trip.lockedAt) {
    return { ok: false, message: 'This trip is locked. Unlock the decision before changing it.' }
  }

  const parsed = tripSettingsSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { ok: false, message: parsed.error.issues[0]?.message, fieldErrors }
  }

  const { trip } = ctx.state
  const changesResults = affectsRecommendation(trip, parsed.data)
  const widened = widensWindow(trip, parsed.data)

  await updateTripSettings(trip.id, parsed.data)

  // Published results describe a trip that no longer exists. Pull them back
  // rather than leave the group reading a stale page.
  let unpublished = false
  if (changesResults && trip.publishedAt) {
    await unpublishResults(trip.id)
    unpublished = true
  }

  revalidatePath(`/trip/${organizerCode}/organizer`)
  revalidatePath(`/trip/${trip.inviteCode}/results`)
  revalidatePath(`/trip/${trip.inviteCode}/decide`)
  revalidatePath(`/join/${trip.inviteCode}`)
  return { ok: true, unpublished, widened: widened && changesResults }
}

export async function addParticipantAction(
  organizerCode: string,
  name: unknown,
): Promise<ActionResult> {
  const ctx = await requireOrganizer(organizerCode)
  if ('error' in ctx) return { ok: false, message: ctx.error }
  if (ctx.state.trip.lockedAt) {
    return { ok: false, message: 'This trip is locked. Unlock the decision first.' }
  }
  if (ctx.state.participants.length >= 12) {
    return { ok: false, message: 'This works best for groups of up to 12.' }
  }

  const parsed = participantNameSchema.safeParse(name)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message }

  const clash = ctx.state.participants.some(
    (p) => p.name.toLowerCase() === parsed.data.toLowerCase(),
  )
  if (clash) {
    return {
      ok: false,
      message: 'Someone on the trip already has that name — add a surname or initial so everyone can find themselves.',
    }
  }

  await addParticipant(ctx.state.trip.id, parsed.data)
  // A new person means the group picture is incomplete again.
  if (ctx.state.trip.publishedAt) await unpublishResults(ctx.state.trip.id)

  revalidatePath(`/trip/${organizerCode}/organizer`)
  revalidatePath(`/join/${ctx.state.trip.inviteCode}`)
  return { ok: true }
}

export async function removeParticipantAction(
  organizerCode: string,
  participantId: string,
): Promise<ActionResult> {
  const ctx = await requireOrganizer(organizerCode)
  if ('error' in ctx) return { ok: false, message: ctx.error }
  if (ctx.state.trip.lockedAt) {
    return { ok: false, message: 'This trip is locked. Unlock the decision first.' }
  }
  if (!ctx.state.participants.some((p) => p.id === participantId)) {
    return { ok: false, message: 'That person is not on this trip.' }
  }
  if (ctx.state.participants.length <= 2) {
    return { ok: false, message: 'A trip needs at least two people.' }
  }

  await removeParticipant(participantId)
  // Their constraints shaped the published options; those options are now wrong.
  if (ctx.state.trip.publishedAt) await unpublishResults(ctx.state.trip.id)

  revalidatePath(`/trip/${organizerCode}/organizer`)
  revalidatePath(`/trip/${ctx.state.trip.inviteCode}/results`)
  return { ok: true }
}

export async function renameParticipantAction(
  organizerCode: string,
  participantId: string,
  name: unknown,
): Promise<ActionResult> {
  const ctx = await requireOrganizer(organizerCode)
  if ('error' in ctx) return { ok: false, message: ctx.error }
  if (!ctx.state.participants.some((p) => p.id === participantId)) {
    return { ok: false, message: 'That person is not on this trip.' }
  }

  const parsed = participantNameSchema.safeParse(name)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message }

  const clash = ctx.state.participants.some(
    (p) => p.id !== participantId && p.name.toLowerCase() === parsed.data.toLowerCase(),
  )
  if (clash) return { ok: false, message: 'Someone else on the trip already has that name.' }

  await renameParticipant(participantId, parsed.data)
  revalidatePath(`/trip/${organizerCode}/organizer`)
  revalidatePath(`/join/${ctx.state.trip.inviteCode}`)
  return { ok: true }
}

export async function unpublishResultsAction(organizerCode: string): Promise<ActionResult> {
  const ctx = await requireOrganizer(organizerCode)
  if ('error' in ctx) return { ok: false, message: ctx.error }
  if (ctx.state.trip.lockedAt) {
    return { ok: false, message: 'Unlock the decision before pulling the results back.' }
  }
  await unpublishResults(ctx.state.trip.id)
  revalidatePath(`/trip/${organizerCode}/organizer`)
  revalidatePath(`/trip/${ctx.state.trip.inviteCode}/results`)
  return { ok: true }
}

export async function lockDecisionAction(
  organizerCode: string,
  optionId: string,
): Promise<ActionResult> {
  const ctx = await requireOrganizer(organizerCode)
  if ('error' in ctx) return { ok: false, message: ctx.error }

  const recommendation = recommendationFor(ctx.state)
  const option = recommendation.options.find((o) => o.id === optionId)
  if (!option) return { ok: false, message: 'That option is no longer on the table.' }

  await lockDecision(ctx.state.trip.id, option, ctx.state.participants)
  revalidatePath(`/trip/${ctx.state.trip.inviteCode}/decide`)
  revalidatePath(`/trip/${organizerCode}/organizer`)
  return { ok: true }
}

export async function unlockDecisionAction(organizerCode: string): Promise<ActionResult> {
  const ctx = await requireOrganizer(organizerCode)
  if ('error' in ctx) return { ok: false, message: ctx.error }
  await unlockDecision(ctx.state.trip.id)
  revalidatePath(`/trip/${ctx.state.trip.inviteCode}/decide`)
  revalidatePath(`/trip/${organizerCode}/organizer`)
  return { ok: true }
}

/* ------------------------------------------------------------------ tasks */

export async function setTaskOwnerAction(
  inviteCode: string,
  taskId: string,
  ownerParticipantId: string | null,
): Promise<ActionResult> {
  const ctx = await requireParticipant(inviteCode)
  if ('error' in ctx) return { ok: false, message: ctx.error }
  if (!ctx.state.tasks.some((t) => t.id === taskId)) {
    return { ok: false, message: 'That task is not on this trip.' }
  }
  await setTaskOwner(taskId, ownerParticipantId)
  revalidatePath(`/trip/${inviteCode}/decide`)
  return { ok: true }
}

export async function setTaskDoneAction(
  inviteCode: string,
  taskId: string,
  done: boolean,
): Promise<ActionResult> {
  const ctx = await requireParticipant(inviteCode)
  if ('error' in ctx) return { ok: false, message: ctx.error }
  if (!ctx.state.tasks.some((t) => t.id === taskId)) {
    return { ok: false, message: 'That task is not on this trip.' }
  }
  await setTaskDone(taskId, done)
  revalidatePath(`/trip/${inviteCode}/decide`)
  return { ok: true }
}
