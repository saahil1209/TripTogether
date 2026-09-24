import { formatRange } from '@/lib/dates'
import { localDestinations } from '@/lib/destinations'
import type { Destination, DestinationSource } from '@/lib/destinations'
import { participantsWord, rupees } from '@/lib/format'
import { STAY_TIERS, STAY_TIER_SHORT } from '@/lib/types'
import type { ParticipantResponse } from '@/lib/types'
import {
  type Candidate, bestPerDestination, buildCandidate, findSmallestCompromise,
  generateCandidates, rankCandidates,
} from './candidates'
import {
  type WindowCandidate, enumerateWindows, feasibleWindows, smallestWorkableWindow,
} from './constraints'
import { buildBoundaries, buildWhyNot, explainOption, fairnessFlags } from './explain'
import type {
  Compromise, EngineInput, IssueKind, OptionRole, Recommendation, TripOption,
} from './types'

export * from './types'
export { buildCandidate, generateCandidates } from './candidates'
export { enumerateWindows, feasibleWindows } from './constraints'

function toOption(
  c: Candidate,
  role: OptionRole | null,
  responses: ParticipantResponse[],
  feasible: WindowCandidate[],
): TripOption {
  const compromise = findSmallestCompromise(c, responses, feasible)
  const compromiseText = compromise ? `${compromise.change}. ${compromise.effect}` : null
  return {
    id: c.id,
    role,
    destination: c.destination,
    start: c.start,
    end: c.end,
    days: c.days,
    nights: Math.max(1, c.days - 1),
    tier: c.tier,
    costLow: c.costLow,
    costHigh: c.costHigh,
    perPerson: c.fits,
    counts: c.counts,
    scores: c.scores,
    viable: c.viable,
    smallestCompromise: compromise,
    explanation: explainOption(c, role, responses, compromiseText),
  }
}

/** Picks at most three options, and never pads: each extra one must earn its slot. */
function chooseRoles(
  pool: Candidate[],
  responses: ParticipantResponse[],
): { candidate: Candidate; role: OptionRole }[] {
  const best = pool[0]
  if (!best) return []
  const chosen: { candidate: Candidate; role: OptionRole }[] = [{ candidate: best, role: 'best' }]
  const usedDestinations = new Set([best.destination.id])

  // Lowest friction only counts if it genuinely asks less of the group.
  const lowestFriction = pool
    .filter((c) => !usedDestinations.has(c.destination.id))
    .sort(
      (a, b) =>
        a.counts.compromise - b.counts.compromise ||
        b.scores.total - a.scores.total ||
        a.destination.id.localeCompare(b.destination.id),
    )[0]
  if (lowestFriction && lowestFriction.counts.compromise < best.counts.compromise) {
    chosen.push({ candidate: lowestFriction, role: 'lowest_friction' })
    usedDestinations.add(lowestFriction.destination.id)
  }

  // A different vibe only earns a slot if it serves a top preference that none
  // of the options already chosen can serve. Anything less is padding.
  const dominant = new Set(chosen.map((c) => c.candidate.destination.vibes[0]))
  const servedTopVibes = new Set(
    chosen.flatMap((c) => c.candidate.destination.vibes),
  )
  const unservedTopVibes = new Set(
    responses
      .map((r) => r.preferences.topVibe)
      .filter((v) => !servedTopVibes.has(v)),
  )
  const differentVibe = pool
    .filter((c) => !usedDestinations.has(c.destination.id))
    .filter((c) => !dominant.has(c.destination.vibes[0]))
    .filter((c) => c.destination.vibes.some((v) => unservedTopVibes.has(v)))
    .sort((a, b) => b.scores.total - a.scores.total || a.destination.id.localeCompare(b.destination.id))[0]
  if (differentVibe) chosen.push({ candidate: differentVibe, role: 'different_vibe' })

  return chosen
}

function commonestHardIssue(candidates: Candidate[]): { kind: IssueKind; count: number } | null {
  const tally = new Map<IssueKind, number>()
  for (const c of candidates) {
    const kinds = new Set(
      c.fits.flatMap((f) => f.issues.filter((i) => i.severity === 'hard').map((i) => i.kind)),
    )
    for (const k of kinds) tally.set(k, (tally.get(k) ?? 0) + 1)
  }
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
  return top ? { kind: top[0], count: top[1] } : null
}

const FRICTION_COPY: Record<IssueKind, string> = {
  over_max_budget: 'the all-in budget ceiling — the lowest maximum in the group is the binding constraint',
  cant_go: 'the dates — there is no window that clears everyone’s can’t-go days',
  no_route: 'travel rules — the routes that exist break someone’s hard no',
  stay_ruled_out: 'the stay tier — the cheapest option is ruled out, which pushes the cost up',
  needs_nightlife: 'nightlife — one participant will not go somewhere without it',
  over_comfortable_budget: 'the budget, which is above comfortable for most of the group',
  vibe_missed: 'the split on what kind of trip this is',
  vibe_partial: 'the split on what kind of trip this is',
  vibe_secondary_missed: 'the split on what kind of trip this is',
  trip_length: 'the length of the trip against the places that are reachable',
  long_travel: 'travel time',
  overnight: 'overnight journeys',
  comfort_below: 'the standard of the stay',
  season: 'the time of year',
  pace: 'the pace of the trip',
}

/** Can a shorter trip or a cheaper tier bring a budget-blocked option into range? */
function budgetFix(
  blocked: Candidate,
  responses: ParticipantResponse[],
): Compromise | null {
  for (const tier of STAY_TIERS) {
    const c = buildCandidate(blocked.destination, blocked.start, blocked.days, tier, responses)
    if (c.counts.conflict === 0) {
      return {
        kind: 'tier_down',
        change: `Drop to ${STAY_TIER_SHORT[tier].toLowerCase()} in ${c.destination.name}`,
        effect: `Brings the all-in estimate to about ${rupees(c.costHigh)} per person, inside everyone's maximum.`,
      }
    }
  }
  for (let days = blocked.days - 1; days >= 2; days--) {
    for (const tier of STAY_TIERS) {
      const c = buildCandidate(blocked.destination, blocked.start, days, tier, responses)
      if (c.counts.conflict === 0) {
        return {
          kind: 'shorter_trip',
          change: `Make it ${days} days instead of ${blocked.days}, at ${STAY_TIER_SHORT[tier].toLowerCase()} level`,
          effect: `Brings the all-in estimate to about ${rupees(c.costHigh)} per person, inside everyone's maximum.`,
        }
      }
    }
  }
  return null
}

export function recommend(
  input: EngineInput,
  source: DestinationSource = localDestinations,
): Recommendation {
  const { responses, participantCount, windowStart, windowEnd, tripLengthDays } = input
  const respondedCount = responses.length
  const destinations: Destination[] = source.all()

  const base = {
    options: [] as TripOption[],
    whyNot: [],
    fairness: [],
    dateFix: null,
    respondedCount,
    participantCount,
  }

  /* --- not enough to work with --- */
  if (respondedCount < 2) {
    return {
      ...base,
      state: 'waiting',
      headline: 'Waiting for more responses',
      detail: respondedCount === 0
        ? 'Nobody has responded yet. Options appear once at least two people have.'
        : 'One response so far. Options appear once at least two people have responded.',
      boundaries: buildBoundaries(responses, []),
    }
  }

  const allWindows = enumerateWindows(windowStart, windowEnd, tripLengthDays, responses)
  const feasible = feasibleWindows(allWindows)
  const boundaries = buildBoundaries(responses, feasible)

  /* --- no dates work for everyone --- */
  if (feasible.length === 0) {
    const fix = smallestWorkableWindow(windowStart, windowEnd, tripLengthDays, responses)
    const nearest = [...allWindows].sort((a, b) => a.blockedBy.length - b.blockedBy.length)[0]
    return {
      ...base,
      state: 'no_date_overlap',
      headline: `No ${tripLengthDays}-day window works for everyone`,
      detail: fix
        ? `The smallest change that fixes it: a ${fix.days}-day trip on ${formatRange(fix.start, fix.end)}, which clears everyone's can't-go days.`
        : nearest
          ? `The closest window is ${formatRange(nearest.start, nearest.end)}, which still clashes with ${participantsWord(nearest.blockedBy.length)}.`
          : 'There is no window of this length inside the dates you set.',
      boundaries,
      dateFix: fix
        ? {
            start: fix.start,
            end: fix.end,
            days: fix.days,
            description: `A ${fix.days}-day trip on ${formatRange(fix.start, fix.end)} works for everyone who has responded.`,
          }
        : null,
    }
  }

  const candidates = generateCandidates(destinations, feasible, responses)
  const viable = candidates.filter((c) => c.viable)

  /* --- everything is blocked --- */
  if (viable.length === 0) {
    const perDestination = bestPerDestination(candidates)
    const friction = commonestHardIssue(perDestination)
    const budgetBlocked = rankCandidates(
      candidates.filter((c) =>
        c.fits.every((f) =>
          f.issues.filter((i) => i.severity === 'hard').every((i) => i.kind === 'over_max_budget'),
        ),
      ),
    )[0]
    const fix = budgetBlocked ? budgetFix(budgetBlocked, responses) : null
    const isBudget = friction?.kind === 'over_max_budget'

    return {
      ...base,
      state: isBudget ? 'no_budget_overlap' : 'none_viable',
      headline: isBudget
        ? 'No destination fits inside everyone’s budget yet'
        : 'We haven’t found a workable option yet',
      detail: [
        friction
          ? `The single constraint causing the most friction is ${FRICTION_COPY[friction.kind]}.`
          : 'Every candidate breaks at least one hard constraint.',
        fix ? `${fix.change}. ${fix.effect}` : '',
      ].filter(Boolean).join(' '),
      whyNot: buildWhyNot(perDestination, responses, 3),
      boundaries,
    }
  }

  /* --- the normal path --- */
  const pool = bestPerDestination(viable)
  const chosen = chooseRoles(pool, responses)
  const options = chosen.map(({ candidate, role }) => toOption(candidate, role, responses, feasible))
  const chosenIds = new Set(options.map((o) => o.destination.id))
  const best = options[0]!
  const whyNot = buildWhyNot(
    bestPerDestination(candidates).filter((c) => !chosenIds.has(c.destination.id)),
    responses,
    2,
    { bestName: best.destination.name, bestCompromises: best.counts.compromise },
  )
  const fairness = fairnessFlags(options, responses)

  // If exactly one stay tier survives everyone's constraints, that is the single
  // most useful thing the group can know about their money.
  const viableTiers = STAY_TIERS.filter(
    (t) => buildCandidate(best.destination, best.start, best.days, t, responses).counts.conflict === 0,
  )
  if (viableTiers.length === 1 && STAY_TIERS.length > 1) {
    boundaries.notes.push(
      `${STAY_TIER_SHORT[viableTiers[0]!]} is the only tier that works for everyone: anything cheaper means shared rooms or hostels that someone ruled out, and anything better goes past the lowest maximum budget in the group.`,
    )
  }
  return {
    ...base,
    state: 'ok',
    headline:
      options.length === 1
        ? `One option works for everyone: ${best.destination.name}`
        : `${options.length} options work for everyone`,
    detail:
      options.length === 1
        ? 'Only one destination clears every hard constraint, so that is all we are showing. Padding the list would not help you decide.'
        : `Every option below clears all ${respondedCount} sets of hard constraints. They differ in who compromises and on what.`,
    options,
    whyNot,
    boundaries,
    fairness,
  }
}
