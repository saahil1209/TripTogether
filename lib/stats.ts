import { type ISODate, daysBetween, formatRange, rangeDays } from './dates'
import type { DealBreakerId, ParticipantResponse, Vibe } from './types'
import { DEAL_BREAKER_LABELS } from './types'

/**
 * Read-only summaries of what the group actually said.
 *
 * These are deliberately only rendered once results are published: before that,
 * showing anyone else's answers is exactly the anchoring the product exists to
 * prevent. Afterwards there is nothing left to anchor, and the numbers are the
 * most interesting part of the whole exercise.
 */

export interface Tally<T> {
  value: T
  label: string
  count: number
}

export interface BudgetStats {
  lowest: number
  highest: number
  median: number
  spread: number
  /** The lowest maximum — the number that actually constrained everything. */
  ceiling: number
  comfortableCeiling: number
}

export interface DayCoverage {
  date: ISODate
  /** How many respondents can travel that day. */
  free: number
  /** How many actively preferred it. */
  preferred: number
  total: number
}

export interface PersonAvailability {
  participantId: string
  name: string
  /** Contiguous stretches they can travel, as "18–22 Oct". */
  ranges: string[]
  daysFree: number
  daysPreferred: number
}

export interface GroupStats {
  respondedCount: number
  participantCount: number
  budget: BudgetStats
  vibes: Tally<Vibe>[]
  topVibes: Tally<Vibe>[]
  dealBreakers: Tally<DealBreakerId>[]
  cities: Tally<string>[]
  coverage: DayCoverage[]
  availability: PersonAvailability[]
  /** Days in the window that work for every single respondent. */
  daysEveryoneFree: number
  windowDays: number
  deeperPassCount: number
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
    : sorted[middle]!
}

function tally<T extends string>(
  items: T[],
  label: (value: T) => string,
): Tally<T>[] {
  const counts = new Map<T, number>()
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, label: label(value), count }))
}

/** Collapses a sorted list of dates into contiguous runs. */
function toRanges(dates: ISODate[]): string[] {
  if (dates.length === 0) return []
  const sorted = [...dates].sort()
  const out: string[] = []
  let start = sorted[0]!
  let previous = start

  for (const date of sorted.slice(1)) {
    if (daysBetween(previous, date) > 1) {
      out.push(formatRange(start, previous))
      start = date
    }
    previous = date
  }
  out.push(formatRange(start, previous))
  return out
}

export function groupStats(
  responses: ParticipantResponse[],
  participantCount: number,
  windowStart: ISODate,
  windowEnd: ISODate,
): GroupStats {
  const all = rangeDays(windowStart, windowEnd)

  const maxima = responses.map((r) => r.preferences.maxBudget)
  const comfortable = responses.map((r) => r.preferences.comfortableBudget)

  const coverage: DayCoverage[] = all.map((date) => {
    let free = 0
    let preferred = 0
    for (const r of responses) {
      if (r.preferences.cantGo.includes(date)) continue
      free += 1
      if (r.preferences.preferDates.includes(date)) preferred += 1
    }
    return { date, free, preferred, total: responses.length }
  })

  const availability: PersonAvailability[] = responses.map((r) => {
    const cant = new Set(r.preferences.cantGo)
    const free = all.filter((d) => !cant.has(d))
    return {
      participantId: r.participantId,
      name: r.name,
      ranges: toRanges(free),
      daysFree: free.length,
      daysPreferred: r.preferences.preferDates.length,
    }
  })

  return {
    respondedCount: responses.length,
    participantCount,
    budget: {
      lowest: maxima.length ? Math.min(...maxima) : 0,
      highest: maxima.length ? Math.max(...maxima) : 0,
      median: median(maxima),
      spread: maxima.length ? Math.max(...maxima) - Math.min(...maxima) : 0,
      ceiling: maxima.length ? Math.min(...maxima) : 0,
      comfortableCeiling: comfortable.length ? Math.min(...comfortable) : 0,
    },
    vibes: tally(
      responses.flatMap((r) => [r.preferences.topVibe, ...r.preferences.otherVibes]),
      (v) => v.charAt(0).toUpperCase() + v.slice(1),
    ),
    topVibes: tally(
      responses.map((r) => r.preferences.topVibe),
      (v) => v.charAt(0).toUpperCase() + v.slice(1),
    ),
    dealBreakers: tally(
      responses.flatMap((r) => r.preferences.dealBreakers),
      (d) => DEAL_BREAKER_LABELS[d],
    ),
    cities: tally(
      responses.map((r) => r.preferences.fromCity),
      (c) => c.charAt(0).toUpperCase() + c.slice(1),
    ),
    coverage,
    availability,
    daysEveryoneFree: coverage.filter((d) => d.free === responses.length && d.free > 0).length,
    windowDays: all.length,
    deeperPassCount: responses.filter((r) => r.preferences.flexibility !== null).length,
  }
}
