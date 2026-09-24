import { type ISODate, rangeDays, windowDays, addDays, daysBetween } from '@/lib/dates'
import type { Destination, Route } from '@/lib/destinations'
import type { Preferences, StayTier } from '@/lib/types'
import { COMFORT_MIN_TIER, STAY_TIERS } from '@/lib/types'

/* ------------------------------------------------------------------ routes */

/** Why a route is unusable for someone. Returns null when the route is fine. */
export function routeBlockedBy(route: Route, prefs: Preferences): string | null {
  const db = new Set(prefs.dealBreakers)
  if (db.has('overnight_travel') && route.overnight) return 'overnight_travel'
  if (db.has('no_flights') && route.mode === 'flight') return 'no_flights'
  if (db.has('very_early_flights') && route.earlyDeparture) return 'very_early_flights'
  if (db.has('long_road_journeys') && route.mode === 'road' && route.hours > 8) return 'long_road_journeys'
  if (db.has('long_travel') && prefs.maxTravelHours !== null && route.hours > prefs.maxTravelHours) {
    return 'long_travel'
  }
  return null
}

export function legalRoutes(dest: Destination, prefs: Preferences): Route[] {
  return (dest.routes[prefs.fromCity] ?? []).filter((r) => routeBlockedBy(r, prefs) === null)
}

/**
 * What an hour of travel is worth to this person, in rupees.
 *
 * Scaled off their comfortable budget, because someone with room to spare will
 * pay to skip a 12-hour bus and someone at their ceiling will not. Used only to
 * choose between routes they could all legally take — never to override a
 * constraint, and never to push anyone past their maximum.
 */
export function timeValue(prefs: Preferences): number {
  const base = Math.min(1200, Math.max(250, prefs.comfortableBudget / 40))
  const wantsSpeed = prefs.priorities.includes('travel_time')
  const wantsCheap = prefs.priorities.includes('cost')
  if (wantsSpeed && wantsCheap) return base
  if (wantsSpeed) return base * 1.8
  if (wantsCheap) return base * 0.5
  return base
}

/** A night on a bus or train costs more than the clock says it does. */
function routeWeight(route: Route, tv: number): number {
  return route.cost + route.hours * tv + (route.overnight ? tv * 5 : 0)
}

const MODE_ORDER = { flight: 0, train: 1, road: 2 } as const

/** Deterministic: weighted best, ties broken by cost, then hours, then mode. */
export function preferredRoute(routes: Route[], prefs: Preferences): Route | null {
  if (routes.length === 0) return null
  const tv = timeValue(prefs)
  return [...routes].sort(
    (a, b) =>
      routeWeight(a, tv) - routeWeight(b, tv) ||
      a.cost - b.cost ||
      a.hours - b.hours ||
      MODE_ORDER[a.mode] - MODE_ORDER[b.mode],
  )[0]!
}

export function cheapestRoute(routes: Route[]): Route | null {
  if (routes.length === 0) return null
  return [...routes].sort((a, b) => a.cost - b.cost || a.hours - b.hours || MODE_ORDER[a.mode] - MODE_ORDER[b.mode])[0]!
}

/* -------------------------------------------------------------- stay tiers */

/**
 * The budget tier means hostels and shared rooms, so it is a hard no for anyone
 * who ruled either of those out. Nothing else about a tier is a hard constraint.
 */
export function tierRuledOut(tier: StayTier, prefs: Preferences): 'shared_rooms' | 'hostels' | null {
  if (tier !== 'budget') return null
  if (prefs.dealBreakers.includes('shared_rooms')) return 'shared_rooms'
  if (prefs.dealBreakers.includes('hostels')) return 'hostels'
  return null
}

export function tierBelowComfort(tier: StayTier, prefs: Preferences): boolean {
  if (!prefs.comfortLevel) return false
  const wanted = COMFORT_MIN_TIER[prefs.comfortLevel]
  return STAY_TIERS.indexOf(tier) < STAY_TIERS.indexOf(wanted)
}

/* -------------------------------------------------------------------- cost */

export function stayCost(dest: Destination, tier: StayTier, days: number): number {
  return dest.dailyCost[tier] * Math.max(1, days - 1)
}

/* ------------------------------------------------------------------ dates */

export interface WindowCandidate {
  start: ISODate
  end: ISODate
  days: number
  /** Participant ids who have marked at least one day in this window "can't go". */
  blockedBy: string[]
}

/** Every window of `days` length inside the trip's rough window. */
export function enumerateWindows(
  windowStart: ISODate,
  windowEnd: ISODate,
  days: number,
  responses: { participantId: string; preferences: Preferences }[],
): WindowCandidate[] {
  const out: WindowCandidate[] = []
  const lastStart = daysBetween(windowStart, windowEnd) - days + 1
  for (let i = 0; i <= lastStart; i++) {
    const start = addDays(windowStart, i)
    const span = new Set(windowDays(start, days))
    const blockedBy = responses
      .filter((r) => r.preferences.cantGo.some((d) => span.has(d)))
      .map((r) => r.participantId)
    out.push({ start, end: addDays(start, days - 1), days, blockedBy })
  }
  return out
}

export function feasibleWindows(all: WindowCandidate[]): WindowCandidate[] {
  return all.filter((w) => w.blockedBy.length === 0)
}

/**
 * When no window of the requested length works, find the smallest adjustment
 * that does: keep the dates and shorten the trip, one day at a time.
 */
export function smallestWorkableWindow(
  windowStart: ISODate,
  windowEnd: ISODate,
  requestedDays: number,
  responses: { participantId: string; preferences: Preferences }[],
): WindowCandidate | null {
  for (let days = requestedDays - 1; days >= 2; days--) {
    const hit = feasibleWindows(enumerateWindows(windowStart, windowEnd, days, responses))[0]
    if (hit) return hit
  }
  return null
}

/** How many days of this window someone actively marked as preferred. */
export function preferredOverlap(start: ISODate, days: number, prefs: Preferences): number {
  const span = new Set(windowDays(start, days))
  return prefs.preferDates.filter((d) => span.has(d)).length
}

export function cantGoInWindow(start: ISODate, days: number, prefs: Preferences): ISODate[] {
  const span = new Set(windowDays(start, days))
  return prefs.cantGo.filter((d) => span.has(d))
}

export { rangeDays }
