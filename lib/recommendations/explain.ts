import { formatRange } from '@/lib/dates'
import type { Destination } from '@/lib/destinations'
import {
  joinNames, participantsPossessive, participantsWord, rupees,
} from '@/lib/format'
import {
  DEAL_BREAKER_GROUP_NOTE, DEAL_BREAKER_LABELS, STAY_TIER_SHORT, VIBE_LABELS,
} from '@/lib/types'
import type { DealBreakerId, ParticipantResponse, Vibe } from '@/lib/types'
import type { Candidate } from './candidates'
import type { WindowCandidate } from './constraints'
import { sortedIssues } from './scoring'
import type {
  Explanation, FairnessFlag, GroupBoundaries, Issue, IssueKind, OptionRole, PersonFit, TripOption, WhyNot,
} from './types'

/* ------------------------------------------------- constraint aggregation */

interface ConstraintGroup {
  kind: IssueKind
  count: number
  severity: Issue['severity']
  vibes: Vibe[]
}

function gatherConstraints(fits: PersonFit[], responses: ParticipantResponse[]): ConstraintGroup[] {
  const map = new Map<IssueKind, ConstraintGroup>()
  for (const fit of fits) {
    const prefs = responses.find((r) => r.participantId === fit.participantId)?.preferences
    for (const issue of fit.issues) {
      const existing = map.get(issue.kind)
      if (existing) {
        existing.count += 1
        if (issue.severity === 'hard' || (issue.severity === 'major' && existing.severity === 'minor')) {
          existing.severity = issue.severity
        }
        if (prefs && !existing.vibes.includes(prefs.topVibe)) existing.vibes.push(prefs.topVibe)
      } else {
        map.set(issue.kind, {
          kind: issue.kind,
          count: 1,
          severity: issue.severity,
          vibes: prefs ? [prefs.topVibe] : [],
        })
      }
    }
  }
  const order: Record<Issue['severity'], number> = { hard: 0, major: 1, minor: 2 }
  return [...map.values()].sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count)
}

/** Group-facing phrasing: names the constraint and a count, never a person. */
function phrase(g: ConstraintGroup, dest: Destination): string {
  const n = g.count
  const vibeList = g.vibes.map((v) => VIBE_LABELS[v].toLowerCase()).join(' and ')
  switch (g.kind) {
    case 'over_max_budget':
      return `the all-in cost exceeds ${participantsPossessive(n)} maximum budget`
    case 'over_comfortable_budget':
      return `it costs more than ${participantsWord(n)} called comfortable`
    case 'vibe_missed':
      return `${vibeList} — the top pick for ${participantsWord(n)} — is not what ${dest.name} offers`
    case 'vibe_secondary_missed':
      return `it is light on something ${participantsWord(n)} also picked`
    case 'vibe_partial':
      return `it is not ${vibeList}, the top pick for ${participantsWord(n)}`
    case 'cant_go':
      return `the dates clash with ${participantsPossessive(n)} can't-go days`
    case 'no_route':
      return `every practical route here breaks ${participantsPossessive(n)} travel rules`
    case 'stay_ruled_out':
      return `a budget stay means shared rooms or hostels, which ${participantsWord(n)} ruled out`
    case 'needs_nightlife':
      return `there is no nightlife here, which ${participantsWord(n)} ruled out`
    case 'long_travel':
      return `the journey is long for ${participantsWord(n)}`
    case 'overnight':
      return `the practical route for ${participantsWord(n)} travels overnight`
    case 'comfort_below':
      return `the stay is a step below what ${participantsWord(n)} would prefer`
    case 'season':
      return `October is only a fair time of year here`
    case 'pace':
      return `the pace is slower than ${participantsWord(n)} wanted`
    case 'trip_length':
      return `${dest.name} does not warrant a trip this long`
  }
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function sentence(parts: string[]): string {
  if (parts.length === 0) return ''
  const joined = parts.length === 1
    ? parts[0]!
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]!}`
  return joined.charAt(0).toUpperCase() + joined.slice(1) + '.'
}

/* -------------------------------------------------------- option narrative */

const ROLE_OPENER: Record<OptionRole, string> = {
  best: 'The strongest overall fit for the group',
  lowest_friction: 'The option that asks the least of anyone',
  different_vibe: 'A genuinely different trip that still works for everyone',
}

export function explainOption(
  c: Candidate,
  role: OptionRole | null,
  responses: ParticipantResponse[],
  compromiseText: string | null,
): Explanation {
  const happy = c.fits.filter((f) => f.status === 'strong' || f.status === 'good')
  const concerned = c.fits.filter((f) => f.status === 'compromise' || f.status === 'conflict')
  const constraints = gatherConstraints(concerned, responses)
  const n = c.fits.length

  const opener = role ? ROLE_OPENER[role] : 'A workable option'
  const strongCount = c.counts.strong + c.counts.good

  const whyThis = [
    `${opener}: ${c.destination.name} in ${formatRange(c.start, c.end)}, ${c.days} days at ${STAY_TIER_SHORT[c.tier].toLowerCase()} level.`,
    `It clears everyone's hard constraints, and ${strongCount} of ${n} ${strongCount === 1 ? 'person is' : 'people are'} a strong or good fit.`,
    `Estimated all-in: ${rupees(c.costLow)}–${rupees(c.costHigh)} per person, travel included.`,
  ].join(' ')

  const whoItSuits = happy.length === 0
    ? 'Nobody is an easy yes on this one.'
    : `${joinNames(happy.map((f) => f.name))} ${happy.length === 1 ? 'is' : 'are'} a good fit as it stands — ${c.destination.vibes.slice(0, 3).map((v) => VIBE_LABELS[v].toLowerCase()).join(', ')} is what ${c.destination.name} does.`

  const whoHasConcerns = concerned.length === 0
    ? 'Nothing is flagged against anyone’s answers.'
    : capitalise(`${participantsWord(concerned.length)} ${concerned.length === 1 ? 'has' : 'have'} something flagged. ${sentence(constraints.slice(0, 2).map((g) => phrase(g, c.destination)))}`)

  const worst = constraints[0]
  const tradeOff = worst
    ? `The trade-off: ${phrase(worst, c.destination)}.`
    : `No real trade-off — this one clears everyone's constraints with room to spare.`

  const canItBeSolved = compromiseText
    ? `Yes. ${compromiseText}`
    : concerned.length === 0
      ? 'Nothing to solve.'
      : 'Not with a single change — this is the shape of the trip if you pick it.'

  return { whyThis, whoItSuits, whoHasConcerns, tradeOff, canItBeSolved }
}

/* ------------------------------------------------------------- why not X? */

export interface WhyNotContext {
  bestName: string
  bestCompromises: number
}

/**
 * Covers both kinds of "why not": candidates blocked by a hard constraint, and
 * candidates that clear every constraint but lost on fit. Silently dropping a
 * viable destination the group will ask about is how a tool loses trust.
 */
export function buildWhyNot(
  excluded: Candidate[],
  responses: ParticipantResponse[],
  limit = 2,
  context: WhyNotContext | null = null,
): WhyNot[] {
  // Deliberately mixed: the runner-up people will ask about, and the strongest
  // candidate a hard constraint knocked out. Two different questions.
  const byTotal = (a: Candidate, b: Candidate) =>
    b.scores.total - a.scores.total || a.destination.id.localeCompare(b.destination.id)
  const viable = [...excluded].filter((c) => c.counts.conflict === 0).sort(byTotal)
  const blocked = [...excluded]
    .filter((c) => c.counts.conflict > 0)
    .sort(
      (a, b) =>
        a.counts.conflict - b.counts.conflict ||
        b.scores.coverage - a.scores.coverage ||
        a.destination.id.localeCompare(b.destination.id),
    )

  const picked: Candidate[] = []
  const half = Math.max(1, Math.floor(limit / 2))
  picked.push(...viable.slice(0, half))
  picked.push(...blocked.slice(0, limit - picked.length))
  if (picked.length < limit) picked.push(...viable.slice(half, half + (limit - picked.length)))

  return picked.map((c) => {
    const appealing = c.fits.filter((f) => f.pluses.some((p) => p.kind === 'top_vibe'))
    // Name the vibe those people actually picked, not the destination's headline.
    const tally = new Map<Vibe, number>()
    for (const f of appealing) {
      const v = responses.find((r) => r.participantId === f.participantId)?.preferences.topVibe
      if (v) tally.set(v, (tally.get(v) ?? 0) + 1)
    }
    const topShared = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
    const lead = topShared
      ? `Fits the ${VIBE_LABELS[topShared[0]].toLowerCase()} preference for ${participantsWord(topShared[1])}`
      : `${c.destination.name} was a serious candidate`

    if (c.counts.conflict > 0) {
      const conflicted = c.fits.filter((f) => f.status === 'conflict')
      const hardGroups = gatherConstraints(conflicted, responses).filter((g) => g.severity === 'hard')
      const blockers = sentence(hardGroups.slice(0, 2).map((g) => phrase(g, c.destination)))
      return {
        destinationId: c.destination.id,
        name: c.destination.name,
        reason: `${lead}, but ${blockers.charAt(0).toLowerCase()}${blockers.slice(1)}`,
      }
    }

    // Viable, but it lost on fit rather than on a constraint.
    const softGroups = gatherConstraints(
      c.fits.filter((f) => f.status === 'compromise' || f.status === 'good'),
      responses,
    )
    const why = sentence(softGroups.slice(0, 2).map((g) => phrase(g, c.destination)))
    const body =
      c.counts.compromise > 0
        ? `but ${participantsWord(c.counts.compromise)} end${c.counts.compromise === 1 ? 's' : ''} up compromising`
        : `but it is a weaker fit overall${context ? ` than ${context.bestName}` : ''}`
    return {
      destinationId: c.destination.id,
      name: c.destination.name,
      reason: [`${lead}, and it clears every hard constraint — ${body}.`, why].filter(Boolean).join(' '),
    }
  })
}

/* ------------------------------------------------------- group boundaries */

export function buildBoundaries(
  responses: ParticipantResponse[],
  workable: WindowCandidate[],
): GroupBoundaries {
  const vibeCount = new Map<Vibe, number>()
  for (const r of responses) {
    for (const v of [r.preferences.topVibe, ...r.preferences.otherVibes]) {
      vibeCount.set(v, (vibeCount.get(v) ?? 0) + 1)
    }
  }
  const half = responses.length / 2
  const sharedVibes = [...vibeCount.entries()]
    .filter(([, n]) => n > half)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([v]) => v)
  const splitVibes = [...vibeCount.entries()]
    .filter(([, n]) => n === 1 && responses.length > 2)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([v]) => v)

  const budgets = responses.map((r) => r.preferences.maxBudget)
  const budgetCeiling = budgets.length ? Math.min(...budgets) : 0
  const spread = budgets.length ? Math.max(...budgets) - budgetCeiling : 0

  const dbCount = new Map<DealBreakerId, number>()
  for (const r of responses) {
    for (const d of r.preferences.dealBreakers) dbCount.set(d, (dbCount.get(d) ?? 0) + 1)
  }
  const hardNos = [...dbCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id, count]) => ({ id, label: DEAL_BREAKER_LABELS[id], count }))

  const notes: string[] = []
  if (workable.length === 1) {
    const w = workable[0]!
    notes.push(`${formatRange(w.start, w.end)} is the only window of this length that works for everyone who has responded.`)
  } else if (workable.length > 1) {
    notes.push(`${workable.length} windows of this length work for everyone who has responded.`)
  }
  if (spread > 0) {
    notes.push(`The real budget ceiling is ${rupees(budgetCeiling)} all-in — the lowest maximum in the group, ${rupees(spread)} below the highest.`)
  }
  for (const { id, count } of hardNos) {
    const note = `${participantsWord(count)} ${DEAL_BREAKER_GROUP_NOTE[id]}.`
    notes.push(note.charAt(0).toUpperCase() + note.slice(1))
  }

  return {
    workableWindows: workable.map((w) => ({ start: w.start, end: w.end })),
    budgetCeiling,
    budgetCeilingIsBinding: spread > 0,
    sharedVibes,
    splitVibes,
    hardNos,
    notes,
  }
}

/* ---------------------------------------------------------------- fairness */

/** Flags anyone who is compromising on every single option we are showing. */
export function fairnessFlags(
  options: TripOption[],
  responses: ParticipantResponse[],
): FairnessFlag[] {
  if (options.length === 0) return []
  const out: FairnessFlag[] = []
  for (const r of responses) {
    const mine = options
      .map((o) => o.perPerson.find((p) => p.participantId === r.participantId))
      .filter((p): p is PersonFit => Boolean(p))
    if (mine.length !== options.length) continue
    if (!mine.every((p) => p.status === 'compromise' || p.status === 'conflict')) continue

    const topIssue = sortedIssues(mine.flatMap((p) => p.issues))[0]
    const vibe = VIBE_LABELS[r.preferences.topVibe].toLowerCase()
    out.push({
      participantId: r.participantId,
      name: r.name,
      constraint: `${vibe} is the one preference no option on this list satisfies, and it is the same person compromising each time`,
      detail: `${r.name} is compromising on every option — ${topIssue?.personal.toLowerCase() ?? 'their top preference is not served'}.`,
    })
  }
  return out
}
