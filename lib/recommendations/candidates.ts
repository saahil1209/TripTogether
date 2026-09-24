import { type ISODate, addDays, formatRange } from '@/lib/dates'
import type { Destination } from '@/lib/destinations'
import { rupees } from '@/lib/format'
import { STAY_TIERS, STAY_TIER_SHORT } from '@/lib/types'
import type { ParticipantResponse, StayTier } from '@/lib/types'
import type { WindowCandidate } from './constraints'
import { countStatuses, evaluatePerson, scoreOption } from './scoring'
import type { Compromise, OptionCounts, OptionScores, PersonFit } from './types'

export interface Candidate {
  id: string
  destination: Destination
  start: ISODate
  end: ISODate
  days: number
  tier: StayTier
  fits: PersonFit[]
  counts: OptionCounts
  scores: OptionScores
  viable: boolean
  costLow: number
  costHigh: number
}

/** Stable across runs: the same inputs always produce the same option id. */
export function candidateId(destId: string, start: ISODate, tier: StayTier, days: number): string {
  return `${destId}_${start}_${tier}_${days}d`
}

export function buildCandidate(
  destination: Destination,
  start: ISODate,
  days: number,
  tier: StayTier,
  responses: ParticipantResponse[],
): Candidate {
  const fits = responses.map((r) => evaluatePerson(destination, start, days, tier, r))
  const counts = countStatuses(fits)
  const scores = scoreOption(fits, destination, start, days, responses)
  const costs = fits.map((f) => f.cost).filter((c) => c > 0)
  return {
    id: candidateId(destination.id, start, tier, days),
    destination,
    start,
    end: addDays(start, days - 1),
    days,
    tier,
    fits,
    counts,
    scores,
    viable: counts.conflict === 0,
    costLow: costs.length ? Math.min(...costs) : 0,
    costHigh: costs.length ? Math.max(...costs) : 0,
  }
}

export function generateCandidates(
  destinations: Destination[],
  windows: WindowCandidate[],
  responses: ParticipantResponse[],
): Candidate[] {
  const out: Candidate[] = []
  for (const dest of destinations) {
    for (const w of windows) {
      for (const tier of STAY_TIERS) {
        out.push(buildCandidate(dest, w.start, w.days, tier, responses))
      }
    }
  }
  return out
}

/** Deterministic ordering: score, then coverage, then cost, then id. */
export function rankCandidates(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort(
    (a, b) =>
      b.scores.total - a.scores.total ||
      b.scores.coverage - a.scores.coverage ||
      a.costHigh - b.costHigh ||
      a.id.localeCompare(b.id),
  )
}

/** The best candidate for each destination, so one place never fills all three slots. */
export function bestPerDestination(candidates: Candidate[]): Candidate[] {
  const byDest = new Map<string, Candidate>()
  for (const c of rankCandidates(candidates)) {
    if (!byDest.has(c.destination.id)) byDest.set(c.destination.id, c)
  }
  return rankCandidates([...byDest.values()])
}

/* -------------------------------------------------------- one small change */

function improvement(before: Candidate, after: Candidate): number {
  const rank = { conflict: 0, compromise: 1, good: 2, strong: 3 } as const
  let gain = 0
  for (const f of before.fits) {
    const a = after.fits.find((x) => x.participantId === f.participantId)
    if (!a) continue
    const delta = rank[a.status] - rank[f.status]
    // Resolving a conflict is worth far more than nudging a good fit to strong.
    gain += f.status === 'conflict' && a.status !== 'conflict' ? 4 : delta
  }
  return gain
}

/**
 * When an option almost works, find the single smallest change that improves it
 * most: one stay tier, one or two days of shift, or one day shorter.
 */
export function findSmallestCompromise(
  base: Candidate,
  responses: ParticipantResponse[],
  feasible: WindowCandidate[],
): Compromise | null {
  type Attempt = { candidate: Candidate; compromise: Compromise }
  const attempts: Attempt[] = []

  const tierIndex = STAY_TIERS.indexOf(base.tier)
  const down = STAY_TIERS[tierIndex - 1]
  const up = STAY_TIERS[tierIndex + 1]

  if (down) {
    const c = buildCandidate(base.destination, base.start, base.days, down, responses)
    attempts.push({
      candidate: c,
      compromise: {
        kind: 'tier_down',
        change: `Drop to ${STAY_TIER_SHORT[down].toLowerCase()}`,
        effect: `Brings the all-in estimate from about ${rupees(base.costHigh)} down to about ${rupees(c.costHigh)} per person.`,
      },
    })
  }
  if (up) {
    const c = buildCandidate(base.destination, base.start, base.days, up, responses)
    attempts.push({
      candidate: c,
      compromise: {
        kind: 'tier_up',
        change: `Move up to ${STAY_TIER_SHORT[up].toLowerCase()}`,
        effect: `Takes the all-in estimate to about ${rupees(c.costHigh)} per person.`,
      },
    })
  }

  for (const shift of [-1, 1, -2, 2]) {
    const start = addDays(base.start, shift)
    if (!feasible.some((w) => w.start === start && w.days === base.days)) continue
    const c = buildCandidate(base.destination, start, base.days, base.tier, responses)
    attempts.push({
      candidate: c,
      compromise: {
        kind: 'shift_dates',
        change: `Shift the dates by ${Math.abs(shift)} day${Math.abs(shift) > 1 ? 's' : ''} to ${formatRange(c.start, c.end)}`,
        effect: 'Same destination and budget, better fit across the group.',
      },
    })
  }

  if (base.days > 2) {
    const c = buildCandidate(base.destination, base.start, base.days - 1, base.tier, responses)
    attempts.push({
      candidate: c,
      compromise: {
        kind: 'shorter_trip',
        change: `Make it ${base.days - 1} days instead of ${base.days}`,
        effect: `Drops the all-in estimate to about ${rupees(c.costHigh)} per person.`,
      },
    })
  }

  const scored = attempts
    .map((a) => ({ ...a, gain: improvement(base, a.candidate) }))
    .filter((a) => a.gain > 0 && a.candidate.counts.conflict <= base.counts.conflict)
    .sort((a, b) => b.gain - a.gain || a.candidate.costHigh - b.candidate.costHigh)

  return scored[0]?.compromise ?? null
}
