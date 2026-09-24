import { type ISODate, rangeDays } from '@/lib/dates'
import type { ParticipantResponse, Preferences, Priority } from '@/lib/types'

/**
 * The five friends from the brief. October 2026, a 4-day trip somewhere in
 * October, everyone leaving from a different city.
 */
export const DEMO_WINDOW_START: ISODate = '2026-10-01'
export const DEMO_WINDOW_END: ISODate = '2026-10-31'
export const DEMO_TRIP_DAYS = 4

/** Everything in the trip window that is not in `available` is a can't-go day. */
function cantGoOutside(available: [ISODate, ISODate]): ISODate[] {
  const ok = new Set(rangeDays(available[0], available[1]))
  return rangeDays(DEMO_WINDOW_START, DEMO_WINDOW_END).filter((d) => !ok.has(d))
}

interface Seed {
  id: string
  name: string
  available: [ISODate, ISODate]
  prefer: [ISODate, ISODate] | null
  prefs: Omit<Preferences, 'cantGo' | 'preferDates'>
}

const base: Pick<
  Preferences,
  'dealBreakerNote' | 'pace' | 'comfortLevel' | 'priorities' | 'flexibility'
> = {
  dealBreakerNote: null,
  pace: null,
  comfortLevel: null,
  priorities: [] as Priority[],
  flexibility: null,
}

export const DEMO_SEEDS: Seed[] = [
  {
    id: 'riya',
    name: 'Riya',
    available: ['2026-10-18', '2026-10-22'],
    prefer: ['2026-10-19', '2026-10-22'],
    prefs: {
      ...base,
      fromCity: 'mumbai',
      maxBudget: 30000,
      comfortableBudget: 26000,
      topVibe: 'beach',
      otherVibes: ['nightlife'],
      dealBreakers: ['long_travel'],
      maxTravelHours: 6,
      dealBreakerNote: "Anything over about 6 hrs each way and I'd rather not go.",
    },
  },
  {
    id: 'siddharth',
    name: 'Siddharth',
    available: ['2026-10-18', '2026-10-25'],
    prefer: ['2026-10-22', '2026-10-25'],
    prefs: {
      ...base,
      fromCity: 'delhi',
      maxBudget: 40000,
      comfortableBudget: 35000,
      topVibe: 'mountains',
      otherVibes: ['nature'],
      dealBreakers: [],
      maxTravelHours: null,
      flexibility: 'very',
    },
  },
  {
    id: 'karan',
    name: 'Karan',
    available: ['2026-10-18', '2026-10-22'],
    prefer: ['2026-10-18', '2026-10-21'],
    prefs: {
      ...base,
      fromCity: 'bengaluru',
      maxBudget: 25000,
      comfortableBudget: 20000,
      topVibe: 'beach',
      otherVibes: ['relaxation'],
      dealBreakers: ['overnight_travel'],
      maxTravelHours: null,
      dealBreakerNote: "I can't sleep on buses or trains. Not doing an overnight.",
    },
  },
  {
    id: 'aisha',
    name: 'Aisha',
    available: ['2026-10-19', '2026-10-23'],
    prefer: ['2026-10-19', '2026-10-23'],
    prefs: {
      ...base,
      fromCity: 'pune',
      maxBudget: 35000,
      comfortableBudget: 30000,
      topVibe: 'beach',
      otherVibes: ['nightlife'],
      dealBreakers: [],
      maxTravelHours: null,
    },
  },
  {
    id: 'preethi',
    name: 'Preethi',
    available: ['2026-10-18', '2026-10-22'],
    prefer: ['2026-10-18', '2026-10-22'],
    prefs: {
      ...base,
      fromCity: 'chennai',
      maxBudget: 30000,
      comfortableBudget: 26000,
      topVibe: 'nature',
      otherVibes: ['beach'],
      dealBreakers: ['shared_rooms'],
      maxTravelHours: null,
      dealBreakerNote: 'I need my own room. Happy to pay a bit more for it.',
    },
  },
]

export function demoResponse(seed: Seed): ParticipantResponse {
  return {
    participantId: seed.id,
    name: seed.name,
    preferences: {
      ...seed.prefs,
      cantGo: cantGoOutside(seed.available),
      preferDates: seed.prefer ? rangeDays(seed.prefer[0], seed.prefer[1]) : [],
    },
  }
}

export function demoResponses(ids?: string[]): ParticipantResponse[] {
  const seeds = ids ? DEMO_SEEDS.filter((s) => ids.includes(s.id)) : DEMO_SEEDS
  return seeds.map(demoResponse)
}

export const DEMO_PARTIAL_IDS = ['riya', 'karan', 'preethi']
