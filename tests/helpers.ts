import { rangeDays } from '@/lib/dates'
import type { ParticipantResponse, Preferences } from '@/lib/types'

export const WINDOW_START = '2026-10-01'
export const WINDOW_END = '2026-10-31'

const DEFAULTS: Preferences = {
  cantGo: [],
  preferDates: [],
  fromCity: 'mumbai',
  maxBudget: 40000,
  comfortableBudget: 40000,
  topVibe: 'beach',
  otherVibes: [],
  dealBreakers: [],
  maxTravelHours: null,
  dealBreakerNote: null,
  pace: null,
  comfortLevel: null,
  priorities: [],
  flexibility: null,
}

/** Marks everything outside `available` as a can't-go day. */
export function availableOnly(from: string, to: string): string[] {
  const ok = new Set(rangeDays(from, to))
  return rangeDays(WINDOW_START, WINDOW_END).filter((d) => !ok.has(d))
}

export function person(
  id: string,
  prefs: Partial<Preferences> = {},
  name = id[0]!.toUpperCase() + id.slice(1),
): ParticipantResponse {
  return { participantId: id, name, preferences: { ...DEFAULTS, ...prefs } }
}
