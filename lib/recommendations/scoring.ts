import { type ISODate, addDays, formatDay, monthOf } from '@/lib/dates'
import type { Destination, Route, SeasonRating } from '@/lib/destinations'
import { hoursLabel, participantsWord, rupees } from '@/lib/format'
import {
  DEAL_BREAKER_CONSTRAINT, STAY_TIER_SHORT, TRAVEL_MODE_LABELS, VIBE_LABELS,
} from '@/lib/types'
import type { FitStatus, ParticipantResponse, StayTier } from '@/lib/types'
import {
  cantGoInWindow, cheapestRoute, legalRoutes, preferredOverlap, preferredRoute,
  routeBlockedBy, stayCost, tierBelowComfort, tierRuledOut,
} from './constraints'
import type { Issue, OptionCounts, OptionScores, PersonFit, Plus } from './types'

export function seasonRating(dest: Destination, month: number): SeasonRating {
  if (month === 10) return dest.octoberRating
  return dest.bestMonths.includes(month) ? 'good' : 'poor'
}

function routeLabel(route: Route | null): string {
  if (!route) return 'No workable route'
  const parts = [TRAVEL_MODE_LABELS[route.mode], `≈${hoursLabel(route.hours)} each way`]
  if (route.overnight) parts.push('overnight')
  return parts.join(' · ')
}

/**
 * Everything one person's preferences say about one candidate trip.
 *
 * Hard constraint violations become `severity: 'hard'` issues, which force a
 * Conflict. No amount of preference matching can cancel one out.
 */
export function evaluatePerson(
  dest: Destination,
  start: ISODate,
  days: number,
  tier: StayTier,
  response: ParticipantResponse,
): PersonFit {
  const prefs = response.preferences
  const issues: Issue[] = []
  const pluses: Plus[] = []
  const end = addDays(start, days - 1)

  /* ---- hard: dates ---- */
  const blockedDays = cantGoInWindow(start, days, prefs)
  if (blockedDays.length > 0) {
    issues.push({
      kind: 'cant_go',
      severity: 'hard',
      personal: `You marked ${formatDay(blockedDays[0]!)}${blockedDays.length > 1 ? ` and ${blockedDays.length - 1} more day${blockedDays.length > 2 ? 's' : ''}` : ''} as can't go`,
      constraint: `these dates clash with one participant's can't-go days`,
    })
  }

  /* ---- hard: is there any route they'll take? ---- */
  const allRoutes = dest.routes[prefs.fromCity] ?? []
  const usable = legalRoutes(dest, prefs)
  let route: Route | null = null

  if (allRoutes.length === 0) {
    issues.push({
      kind: 'no_route',
      severity: 'hard',
      personal: `We have no route from ${prefs.fromCity} to ${dest.name} in our data`,
      constraint: `there is no usable route for one participant`,
    })
  } else if (usable.length === 0) {
    const reasons = new Set(allRoutes.map((r) => routeBlockedBy(r, prefs)!).filter(Boolean))
    const reason = [...reasons][0]!
    issues.push({
      kind: 'no_route',
      severity: 'hard',
      personal: `Every practical route here breaks your rule: ${DEAL_BREAKER_CONSTRAINT[reason as keyof typeof DEAL_BREAKER_CONSTRAINT] ?? reason}`,
      constraint: `the only routes that work here break one participant's rule of ${DEAL_BREAKER_CONSTRAINT[reason as keyof typeof DEAL_BREAKER_CONSTRAINT] ?? reason}`,
    })
  } else {
    route = preferredRoute(usable, prefs)
  }

  /* ---- hard: stay tier ruled out ---- */
  const tierBlock = tierRuledOut(tier, prefs)
  if (tierBlock) {
    issues.push({
      kind: 'stay_ruled_out',
      severity: 'hard',
      personal: tierBlock === 'shared_rooms'
        ? 'This budget tier means shared rooms, which you ruled out'
        : 'This budget tier means hostels, which you ruled out',
      constraint: `a budget stay means ${tierBlock === 'shared_rooms' ? 'shared rooms' : 'hostels'}, which ${participantsWord(1)} ruled out`,
    })
  }

  /* ---- hard: needs nightlife ---- */
  if (prefs.dealBreakers.includes('needs_nightlife') && dest.nightlife === 'none') {
    issues.push({
      kind: 'needs_nightlife',
      severity: 'hard',
      personal: `${dest.name} has essentially no nightlife, which you ruled out`,
      constraint: `there is no nightlife here, which one participant ruled out`,
    })
  }

  /* ---- cost ---- */
  const localCost = stayCost(dest, tier, days)
  let travelCost = route?.cost ?? 0
  if (route && localCost + route.cost > prefs.maxBudget) {
    // Stretch to fit before calling it a conflict: take the cheapest legal route.
    const cheap = cheapestRoute(usable)
    if (cheap && localCost + cheap.cost <= prefs.maxBudget) {
      route = cheap
      travelCost = cheap.cost
    }
  }
  travelCost = route?.cost ?? 0
  const cost = localCost + travelCost

  if (route && cost > prefs.maxBudget) {
    issues.push({
      kind: 'over_max_budget',
      severity: 'hard',
      personal: `${rupees(cost)} all-in is ${rupees(cost - prefs.maxBudget)} over your ${rupees(prefs.maxBudget)} maximum`,
      constraint: `the all-in cost exceeds one participant's maximum budget`,
    })
  } else if (route && cost > prefs.comfortableBudget) {
    const over = cost - prefs.comfortableBudget
    const ratio = over / Math.max(1, prefs.comfortableBudget)
    issues.push({
      kind: 'over_comfortable_budget',
      severity: ratio > 0.1 ? 'major' : 'minor',
      personal: `${rupees(over)} above your comfortable budget of ${rupees(prefs.comfortableBudget)}`,
      constraint: `it sits above what ${participantsWord(1)} called comfortable`,
    })
  } else if (route) {
    pluses.push({
      kind: 'under_budget',
      personal: `${rupees(prefs.comfortableBudget - cost)} under your comfortable budget`,
    })
  }

  /* ---- vibe ---- */
  const destVibes = new Set(dest.vibes)
  const topMatch = destVibes.has(prefs.topVibe)
  const otherMatches = prefs.otherVibes.filter((v) => destVibes.has(v))
  const otherMissed = prefs.otherVibes.filter((v) => !destVibes.has(v))
  if (topMatch) {
    pluses.push({ kind: 'top_vibe', personal: `${VIBE_LABELS[prefs.topVibe]} is what you picked as mattering most` })
    for (const v of otherMatches) {
      pluses.push({ kind: 'other_vibe', personal: `${VIBE_LABELS[v]} too` })
    }
    if (otherMissed.length > 0) {
      issues.push({
        kind: 'vibe_secondary_missed',
        severity: 'minor',
        personal: `Light on ${otherMissed.map((v) => VIBE_LABELS[v].toLowerCase()).join(' and ')}, which you also picked`,
        constraint: `it is light on ${otherMissed.map((v) => VIBE_LABELS[v].toLowerCase()).join(' and ')}`,
      })
    }
  } else if (otherMatches.length > 0) {
    issues.push({
      kind: 'vibe_partial',
      severity: 'minor',
      personal: `Not ${VIBE_LABELS[prefs.topVibe].toLowerCase()}, but it does deliver ${otherMatches.map((v) => VIBE_LABELS[v].toLowerCase()).join(' and ')}`,
      constraint: `it does not serve one participant's top vibe`,
    })
    pluses.push({
      kind: 'other_vibe',
      personal: `${otherMatches.map((v) => VIBE_LABELS[v]).join(' and ')} is on your list`,
    })
  } else {
    issues.push({
      kind: 'vibe_missed',
      severity: 'major',
      personal: `None of your picks — ${[prefs.topVibe, ...prefs.otherVibes].map((v) => VIBE_LABELS[v].toLowerCase()).join(', ')} — are what ${dest.name} is about`,
      constraint: `${VIBE_LABELS[prefs.topVibe].toLowerCase()} is not what this destination offers`,
    })
  }

  /* ---- travel comfort (soft, on top of the hard route filter) ---- */
  if (route) {
    if (prefs.maxTravelHours !== null && route.hours > prefs.maxTravelHours * 0.8) {
      issues.push({
        kind: 'long_travel',
        severity: 'minor',
        personal: `≈${hoursLabel(route.hours)} each way, close to your ${hoursLabel(prefs.maxTravelHours)} limit`,
        constraint: `the journey is close to one participant's travel-time limit`,
      })
    } else if (route.hours >= 10) {
      issues.push({
        kind: 'long_travel',
        severity: 'minor',
        personal: `A long haul: ≈${hoursLabel(route.hours)} each way`,
        constraint: `it is a long journey for at least one participant`,
      })
    } else if (route.hours <= 4) {
      pluses.push({ kind: 'short_travel', personal: `Short journey: ≈${hoursLabel(route.hours)} each way` })
    }
    if (route.overnight) {
      issues.push({
        kind: 'overnight',
        severity: 'minor',
        personal: `${route.note}`,
        constraint: `the practical route travels overnight`,
      })
    }
  }

  /* ---- comfort level (deeper pass, soft) ---- */
  if (tierBelowComfort(tier, prefs)) {
    issues.push({
      kind: 'comfort_below',
      severity: 'minor',
      personal: `${STAY_TIER_SHORT[tier]} is a step below what you said you'd want`,
      constraint: `the stay tier is below what one participant would prefer`,
    })
  }

  /* ---- season ---- */
  const rating = seasonRating(dest, monthOf(start))
  if (rating === 'poor') {
    issues.push({ kind: 'season', severity: 'major', personal: dest.octoberNote, constraint: `this is not a good time of year for ${dest.name}` })
  } else if (rating === 'fair') {
    issues.push({ kind: 'season', severity: 'minor', personal: dest.octoberNote, constraint: `the season is only fair` })
  }

  /* ---- is this trip the right length for the place? ---- */
  const [minDays, maxDays] = dest.idealDays
  const excess = days > maxDays ? days - maxDays : days < minDays ? minDays - days : 0
  if (excess > 0) {
    const tooLong = days > maxDays
    // A long journey to a place that does not warrant the days is a real
    // problem, not a niggle — so the same mismatch weighs more from further out.
    const farToCome = (route?.hours ?? 0) > 4
    issues.push({
      kind: 'trip_length',
      severity: excess >= 2 || farToCome ? 'major' : 'minor',
      personal: tooLong
        ? `${days} days is longer than ${dest.name} really warrants — ${minDays}–${maxDays} is about right`
        : `${days} days is short for ${dest.name}, given the journey — ${minDays}–${maxDays} is about right`,
      constraint: tooLong
        ? `${days} days is longer than ${dest.name} warrants`
        : `${days} days is not long enough to be worth the journey to ${dest.name}`,
    })
  }

  /* ---- pace (deeper pass, soft) ---- */
  if (prefs.pace === 'packed' && dest.vibes[0] === 'relaxation') {
    issues.push({ kind: 'pace', severity: 'minor', personal: 'Quieter than the packed trip you said you wanted', constraint: `the pace is slower than one participant wanted` })
  }

  /* ---- preferred dates ---- */
  if (preferredOverlap(start, days, prefs) > 0) {
    pluses.push({ kind: 'preferred_dates', personal: 'These are dates you marked as preferred' })
  }

  /* ---- nightlife ---- */
  if (dest.nightlife === 'strong' && [prefs.topVibe, ...prefs.otherVibes].includes('nightlife')) {
    pluses.push({ kind: 'nightlife', personal: 'Plenty of nightlife, which is on your list' })
  }

  const status = statusFrom(issues, topMatch)
  return {
    participantId: response.participantId,
    name: response.name,
    status,
    mainReason: mainReason(status, issues, pluses),
    issues,
    pluses,
    cost,
    travelCost,
    route,
    routeLabel: routeLabel(route),
    fromCity: prefs.fromCity,
  }
}

/**
 * A missed nice-to-have is worth saying out loud but is not evidence against
 * the trip, so it is reported and then excluded from the status threshold.
 */
const NOT_A_DEMOTION: ReadonlySet<Issue['kind']> = new Set(['vibe_secondary_missed'])

function statusFrom(issues: Issue[], topVibeMatched: boolean): FitStatus {
  if (issues.some((i) => i.severity === 'hard')) return 'conflict'
  if (issues.some((i) => i.severity === 'major')) return 'compromise'
  const minors = issues.filter((i) => i.severity === 'minor' && !NOT_A_DEMOTION.has(i.kind)).length
  if (topVibeMatched && minors <= 1) return 'strong'
  return 'good'
}

const ISSUE_RANK: Record<Issue['severity'], number> = { hard: 0, major: 1, minor: 2 }

export function sortedIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => ISSUE_RANK[a.severity] - ISSUE_RANK[b.severity])
}

const PLUS_RANK: Record<Plus['kind'], number> = {
  top_vibe: 0, under_budget: 1, short_travel: 2, nightlife: 3, preferred_dates: 4, other_vibe: 5,
}

function mainReason(status: FitStatus, issues: Issue[], pluses: Plus[]): string {
  if (status === 'conflict' || status === 'compromise') {
    return sortedIssues(issues)[0]?.personal ?? 'Needs a compromise'
  }
  // A Good fit is good rather than strong *because* of something. Leading with
  // a compliment would bury the one thing this person needs to see.
  if (status === 'good') {
    const top = sortedIssues(issues)[0]
    if (top) return top.personal
  }
  const plus = [...pluses].sort((a, b) => PLUS_RANK[a.kind] - PLUS_RANK[b.kind])[0]
  if (plus) return plus.personal
  const minor = sortedIssues(issues)[0]
  return minor ? minor.personal : 'Nothing flagged against your answers'
}

/* ------------------------------------------------------------ group layer */

export function countStatuses(fits: PersonFit[]): OptionCounts {
  return {
    strong: fits.filter((f) => f.status === 'strong').length,
    good: fits.filter((f) => f.status === 'good').length,
    compromise: fits.filter((f) => f.status === 'compromise').length,
    conflict: fits.filter((f) => f.status === 'conflict').length,
  }
}

const SEASON_SCORE: Record<SeasonRating, number> = { excellent: 1, good: 0.8, fair: 0.4, poor: 0 }

/**
 * Not an average of individual scores: coverage and compromise severity are
 * counted separately so that one person in deep compromise cannot be smoothed
 * over by four people who are delighted.
 */
export function scoreOption(
  fits: PersonFit[],
  dest: Destination,
  start: ISODate,
  days: number,
  responses: ParticipantResponse[],
): OptionScores {
  const n = Math.max(1, fits.length)
  const c = countStatuses(fits)
  const coverage = (c.strong * 1 + c.good * 0.7 + c.compromise * 0.25) / n

  const severity = fits.reduce((sum, f) => {
    const s = f.issues.reduce(
      (acc, i) => acc + (i.severity === 'hard' ? 2 : i.severity === 'major' ? 1 : 0.25),
      0,
    )
    return sum + Math.min(2, s)
  }, 0) / (n * 2)

  const preferredDates =
    responses.filter((r) => preferredOverlap(start, days, r.preferences) > 0).length / n

  const season = SEASON_SCORE[seasonRating(dest, monthOf(start))]

  const total = coverage * 0.65 + preferredDates * 0.1 + season * 0.1 - severity * 0.15
  return { coverage, severity, preferredDates, season, total }
}
