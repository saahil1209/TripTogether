import { z } from 'zod'
import { isISODate } from './dates'
import {
  CITIES, COMFORT_LEVELS, DEAL_BREAKERS, FLEXIBILITIES, PACES, PRIORITIES, VIBES,
} from './types'

const isoDate = z.string().refine(isISODate, 'Expected a YYYY-MM-DD date')

const participantName = z
  .string()
  .trim()
  .min(1, 'Names need at least one character')
  .max(40, 'That name is too long')

/** Exported for the organizer's add/rename controls. */
export const participantNameSchema = participantName

export const preferencesSchema = z
  .object({
    fromCity: z.enum(CITIES),
    cantGo: z.array(isoDate).default([]),
    preferDates: z.array(isoDate).default([]),
    maxBudget: z.number().int().min(1000, 'That seems too low for a trip').max(1_000_000),
    comfortableBudget: z.number().int().min(1000).max(1_000_000),
    topVibe: z.enum(VIBES),
    otherVibes: z.array(z.enum(VIBES)).max(2).default([]),
    dealBreakers: z.array(z.enum(DEAL_BREAKERS)).default([]),
    maxTravelHours: z.number().min(1).max(48).nullable().default(null),
    dealBreakerNote: z.string().max(500).nullable().default(null),
    pace: z.enum(PACES).nullable().default(null),
    comfortLevel: z.enum(COMFORT_LEVELS).nullable().default(null),
    priorities: z.array(z.enum(PRIORITIES)).max(3).default([]),
    flexibility: z.enum(FLEXIBILITIES).nullable().default(null),
  })
  .refine((p) => p.comfortableBudget <= p.maxBudget, {
    message: 'Your comfortable budget cannot be higher than your maximum',
    path: ['comfortableBudget'],
  })
  .refine((p) => !p.dealBreakers.includes('long_travel') || p.maxTravelHours !== null, {
    message: 'Tell us the number of hours',
    path: ['maxTravelHours'],
  })
  .refine((p) => !p.otherVibes.includes(p.topVibe), {
    message: 'Your top pick is already counted',
    path: ['otherVibes'],
  })

/** A draft is legitimately incomplete — it is saved on every step. */
export const draftPreferencesSchema = z
  .object({
    fromCity: z.enum(CITIES).optional(),
    cantGo: z.array(isoDate).optional(),
    preferDates: z.array(isoDate).optional(),
    maxBudget: z.number().int().min(0).max(1_000_000).optional(),
    comfortableBudget: z.number().int().min(0).max(1_000_000).optional(),
    topVibe: z.enum(VIBES).optional(),
    otherVibes: z.array(z.enum(VIBES)).max(2).optional(),
    dealBreakers: z.array(z.enum(DEAL_BREAKERS)).optional(),
    maxTravelHours: z.number().min(0).max(48).nullable().optional(),
    dealBreakerNote: z.string().max(500).nullable().optional(),
    pace: z.enum(PACES).nullable().optional(),
    comfortLevel: z.enum(COMFORT_LEVELS).nullable().optional(),
    priorities: z.array(z.enum(PRIORITIES)).max(3).optional(),
    flexibility: z.enum(FLEXIBILITIES).nullable().optional(),
  })
  .partial()

export type DraftPreferences = z.infer<typeof draftPreferencesSchema>

/* Shared cross-field rules, so the form and the wire contract cannot drift. */

const windowOrdered = {
  check: (t: { windowStart: string; windowEnd: string }) => t.windowStart < t.windowEnd,
  message: 'The window has to end after it starts',
  path: ['windowEnd'] as const,
}

const tripFitsWindow = {
  check: (t: { windowStart: string; windowEnd: string; tripLengthDays: number }) => {
    const days = (Date.parse(t.windowEnd) - Date.parse(t.windowStart)) / 86_400_000 + 1
    return t.tripLengthDays <= days
  },
  message: "The trip can't be longer than the window it sits in",
  path: ['tripLengthDays'] as const,
}

const namesAreDistinct = (names: string[]) =>
  new Set(names.map((n) => n.trim().toLowerCase())).size === names.length

const DUPLICATE_NAME_MESSAGE =
  'Two people have the same name — add a surname or initial so everyone can find themselves'

const tripBase = z.object({
  name: z.string().trim().min(2, 'Give the trip a name').max(80),
  windowStart: isoDate,
  windowEnd: isoDate,
  tripLengthDays: z.number().int().min(2, 'At least 2 days').max(21, 'At most 21 days'),
  responseDeadline: isoDate.nullable(),
})

/** The wire contract. The server validates against this and nothing else. */
export const createTripSchema = tripBase
  .extend({
    participantNames: z
      .array(participantName)
      .min(2, 'A trip needs at least two people')
      .max(12, 'This works best for groups of up to 12'),
  })
  .refine(windowOrdered.check, { message: windowOrdered.message, path: [...windowOrdered.path] })
  .refine(tripFitsWindow.check, { message: tripFitsWindow.message, path: [...tripFitsWindow.path] })
  .refine((t) => namesAreDistinct(t.participantNames), {
    message: DUPLICATE_NAME_MESSAGE,
    path: ['participantNames'],
  })

export type CreateTripInput = z.infer<typeof createTripSchema>

/**
 * The same trip, shaped for the form. react-hook-form's useFieldArray only
 * tracks arrays of objects, so the names live as `{ name }` here and are
 * flattened on submit.
 */
export const createTripFormSchema = tripBase
  .extend({
    people: z
      .array(z.object({ name: participantName }))
      .min(2, 'A trip needs at least two people')
      .max(12, 'This works best for groups of up to 12'),
  })
  .refine(windowOrdered.check, { message: windowOrdered.message, path: [...windowOrdered.path] })
  .refine(tripFitsWindow.check, { message: tripFitsWindow.message, path: [...tripFitsWindow.path] })
  .refine((t) => namesAreDistinct(t.people.map((p) => p.name)), {
    message: DUPLICATE_NAME_MESSAGE,
    path: ['people'],
  })

export type CreateTripFormValues = z.infer<typeof createTripFormSchema>

export function toCreateTripInput(values: CreateTripFormValues): CreateTripInput {
  return {
    name: values.name,
    windowStart: values.windowStart,
    windowEnd: values.windowEnd,
    tripLengthDays: values.tripLengthDays,
    responseDeadline: values.responseDeadline,
    participantNames: values.people.map((p) => p.name.trim()).filter((n) => n.length > 0),
  }
}

/** Editing a live trip. Same rules as creation, minus the participant list. */
export const tripSettingsSchema = z
  .object({
    name: z.string().trim().min(2, 'Give the trip a name').max(80),
    windowStart: isoDate,
    windowEnd: isoDate,
    tripLengthDays: z.number().int().min(2, 'At least 2 days').max(21, 'At most 21 days'),
    responseDeadline: isoDate.nullable(),
    decisionDeadline: isoDate.nullable(),
  })
  .refine((t) => t.windowStart < t.windowEnd, {
    message: 'The window has to end after it starts',
    path: ['windowEnd'],
  })
  .refine(
    (t) => {
      const days = (Date.parse(t.windowEnd) - Date.parse(t.windowStart)) / 86_400_000 + 1
      return t.tripLengthDays <= days
    },
    { message: "The trip can't be longer than the window it sits in", path: ['tripLengthDays'] },
  )

export type TripSettingsInput = z.infer<typeof tripSettingsSchema>

export const reactionSchema = z.enum(['love', 'happy', 'could', 'no'])
export type ReactionValue = z.infer<typeof reactionSchema>
