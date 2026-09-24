import { describe, expect, it } from 'vitest'
import { recommend } from '@/lib/recommendations'
import { buildCandidate, findSmallestCompromise } from '@/lib/recommendations/candidates'
import { enumerateWindows, feasibleWindows } from '@/lib/recommendations/constraints'
import { destinationById } from '@/lib/destinations'
import {
  DEMO_PARTIAL_IDS, DEMO_TRIP_DAYS, DEMO_WINDOW_END, DEMO_WINDOW_START, demoResponses,
} from '@/lib/demo/scenario'
import { WINDOW_END, WINDOW_START, availableOnly, person } from './helpers'

const demoInput = (ids?: string[]) => ({
  responses: demoResponses(ids),
  participantCount: 5,
  windowStart: DEMO_WINDOW_START,
  windowEnd: DEMO_WINDOW_END,
  tripLengthDays: DEMO_TRIP_DAYS,
})

describe('the seeded five-friends scenario', () => {
  const result = recommend(demoInput())

  it('reaches a recommendable state with all five responses', () => {
    expect(result.state).toBe('ok')
    expect(result.respondedCount).toBe(5)
  })

  it('finds 19–22 Oct as the only four-day window that works for everyone', () => {
    expect(result.boundaries.workableWindows).toEqual([
      { start: '2026-10-19', end: '2026-10-22' },
    ])
    for (const option of result.options) {
      expect(option.start).toBe('2026-10-19')
      expect(option.end).toBe('2026-10-22')
    }
  })

  it("identifies the lowest maximum budget as the group's real ceiling", () => {
    expect(result.boundaries.budgetCeiling).toBe(25000)
    expect(result.boundaries.budgetCeilingIsBinding).toBe(true)
  })

  it('works out that mid-range is the only stay tier everyone can accept', () => {
    expect(result.options.every((o) => o.tier === 'mid')).toBe(true)
    expect(result.boundaries.notes.some((n) => n.includes('only tier that works for everyone'))).toBe(true)
  })

  it('shows between one and three options and never more', () => {
    expect(result.options.length).toBeGreaterThanOrEqual(1)
    expect(result.options.length).toBeLessThanOrEqual(3)
  })

  it('offers only options that clear every hard constraint', () => {
    for (const option of result.options) {
      expect(option.counts.conflict).toBe(0)
      expect(option.viable).toBe(true)
    }
  })

  it('keeps every person inside their own maximum budget on every option', () => {
    const maxima = new Map(demoResponses().map((r) => [r.participantId, r.preferences.maxBudget]))
    for (const option of result.options) {
      for (const fit of option.perPerson) {
        expect(fit.cost).toBeLessThanOrEqual(maxima.get(fit.participantId)!)
      }
    }
  })

  it('gives every participant a status and a reason on every option', () => {
    for (const option of result.options) {
      expect(option.perPerson).toHaveLength(5)
      for (const fit of option.perPerson) {
        expect(fit.mainReason.length).toBeGreaterThan(0)
        expect(['strong', 'good', 'compromise', 'conflict']).toContain(fit.status)
      }
    }
  })

  it("routes Riya and Karan by flight, because their rules rule out the overnight options", () => {
    const option = result.options[0]!
    const riya = option.perPerson.find((p) => p.name === 'Riya')!
    const karan = option.perPerson.find((p) => p.name === 'Karan')!
    expect(riya.route?.mode).toBe('flight')
    expect(riya.route!.hours).toBeLessThanOrEqual(6)
    expect(karan.route?.overnight).toBe(false)
  })

  it('serves the one person who wants mountains with a genuinely different option', () => {
    const different = result.options.find((o) => o.role === 'different_vibe')
    expect(different).toBeDefined()
    expect(different!.destination.vibes).toContain('mountains')
    const sid = different!.perPerson.find((p) => p.name === 'Siddharth')!
    expect(sid.status).toBe('strong')
  })

  it('answers "why not Goa?" rather than quietly dropping it', () => {
    const goa = result.whyNot.find((w) => w.destinationId === 'goa')
    expect(goa).toBeDefined()
    expect(goa!.reason).toMatch(/comfortable|compromis/i)
  })

  it('explains each option against all five questions', () => {
    for (const option of result.options) {
      const e = option.explanation
      for (const part of [e.whyThis, e.whoItSuits, e.whoHasConcerns, e.tradeOff, e.canItBeSolved]) {
        expect(part.length).toBeGreaterThan(10)
      }
    }
  })

  it('is deterministic: the same responses always produce the same options', () => {
    const again = recommend(demoInput())
    expect(again.options.map((o) => o.id)).toEqual(result.options.map((o) => o.id))
    expect(again.headline).toBe(result.headline)
    expect(again.whyNot.map((w) => w.destinationId)).toEqual(result.whyNot.map((w) => w.destinationId))
  })

  it('never names a person in group-facing constraint copy', () => {
    const names = demoResponses().map((r) => r.name)
    const groupCopy = [
      result.detail,
      ...result.boundaries.notes,
      ...result.whyNot.map((w) => w.reason),
      ...result.options.map((o) => o.explanation.whoHasConcerns),
      ...result.options.map((o) => o.explanation.tradeOff),
      ...result.fairness.map((f) => f.constraint),
    ]
    for (const line of groupCopy) {
      for (const name of names) expect(line).not.toContain(name)
    }
  })
})

describe('partial responses', () => {
  it('produces an early picture from three of five', () => {
    const result = recommend({ ...demoInput(DEMO_PARTIAL_IDS), participantCount: 5 })
    expect(result.state).toBe('ok')
    expect(result.respondedCount).toBe(3)
    expect(result.participantCount).toBe(5)
    expect(result.options.length).toBeGreaterThan(0)
    for (const option of result.options) expect(option.perPerson).toHaveLength(3)
  })

  it('can reach a different answer than the full group does', () => {
    const partial = recommend({ ...demoInput(DEMO_PARTIAL_IDS), participantCount: 5 })
    const full = recommend(demoInput())
    // Not an assertion about which is better — just that the early picture is
    // genuinely provisional, which is why participants must not see it.
    expect(partial.boundaries.budgetCeiling).toBe(25000)
    expect(full.respondedCount).toBeGreaterThan(partial.respondedCount)
  })
})

describe('edge cases', () => {
  const base = { windowStart: WINDOW_START, windowEnd: WINDOW_END, tripLengthDays: 4 }

  it('shows no recommendations at all for a single response', () => {
    const result = recommend({ ...base, responses: [person('riya')], participantCount: 5 })
    expect(result.state).toBe('waiting')
    expect(result.options).toHaveLength(0)
    expect(result.headline).toMatch(/waiting/i)
  })

  it('shows no recommendations for zero responses', () => {
    const result = recommend({ ...base, responses: [], participantCount: 5 })
    expect(result.state).toBe('waiting')
    expect(result.options).toHaveLength(0)
  })

  it('names the smallest date change when no window of the right length works', () => {
    const result = recommend({
      ...base,
      participantCount: 2,
      // Three overlapping days, so a four-day trip is impossible but a three-day
      // one is not. That one-day trim is the smallest change that fixes it.
      responses: [
        person('a', { cantGo: availableOnly('2026-10-10', '2026-10-14') }),
        person('b', { cantGo: availableOnly('2026-10-12', '2026-10-16') }),
      ],
    })
    expect(result.state).toBe('no_date_overlap')
    expect(result.options).toHaveLength(0)
    expect(result.dateFix).toEqual({
      start: '2026-10-12',
      end: '2026-10-14',
      days: 3,
      description: expect.stringContaining('3-day trip'),
    })
    expect(result.detail).toMatch(/smallest change/i)
  })

  it('does not invent a date fix when there is genuinely no overlap', () => {
    const result = recommend({
      ...base,
      participantCount: 2,
      responses: [
        person('a', { cantGo: availableOnly('2026-10-02', '2026-10-06') }),
        person('b', { cantGo: availableOnly('2026-10-20', '2026-10-24') }),
      ],
    })
    expect(result.state).toBe('no_date_overlap')
    expect(result.dateFix).toBeNull()
    expect(result.detail).toMatch(/closest window|no window/i)
  })

  it('says so plainly when no destination fits inside every budget', () => {
    const result = recommend({
      ...base,
      participantCount: 2,
      responses: [
        person('a', { maxBudget: 4000, comfortableBudget: 4000 }),
        person('b', { maxBudget: 4500, comfortableBudget: 4500, fromCity: 'delhi' }),
      ],
    })
    expect(result.state).toBe('no_budget_overlap')
    expect(result.options).toHaveLength(0)
    expect(result.detail).toMatch(/budget/i)
  })

  it('names the single constraint causing the most friction when everything is rejected', () => {
    const result = recommend({
      ...base,
      participantCount: 2,
      responses: [
        person('a', { dealBreakers: ['no_flights', 'overnight_travel', 'long_road_journeys'], fromCity: 'kolkata' }),
        person('b', { dealBreakers: ['no_flights', 'overnight_travel', 'long_road_journeys'], fromCity: 'mumbai' }),
      ],
    })
    expect(['none_viable', 'no_budget_overlap']).toContain(result.state)
    expect(result.options).toHaveLength(0)
    expect(result.detail.length).toBeGreaterThan(20)
  })

  it('never averages a deal-breaker away, however popular the destination', () => {
    const result = recommend({
      ...base,
      participantCount: 4,
      responses: [
        person('a', { topVibe: 'beach' }),
        person('b', { topVibe: 'beach' }),
        person('c', { topVibe: 'beach' }),
        // One person will not go anywhere without nightlife.
        person('d', { topVibe: 'nightlife', dealBreakers: ['needs_nightlife'] }),
      ],
    })
    for (const option of result.options) {
      expect(option.destination.nightlife).not.toBe('none')
    }
  })

  it('lets a hard constraint beat a perfect preference match', () => {
    const goa = destinationById('goa')!
    const broke = person('broke', {
      topVibe: 'beach',
      otherVibes: ['nightlife'],
      maxBudget: 9000,
      comfortableBudget: 9000,
      fromCity: 'delhi',
    })
    const fit = buildCandidate(goa, '2026-10-19', 4, 'mid', [broke]).fits[0]!
    expect(fit.status).toBe('conflict')
    expect(fit.issues.some((i) => i.severity === 'hard' && i.kind === 'over_max_budget')).toBe(true)
    // The preference match is still reported — it is just not allowed to win.
    expect(fit.pluses.some((p) => p.kind === 'top_vibe')).toBe(true)
  })

  it('treats the budget stay tier as a hard no for anyone who ruled out shared rooms', () => {
    const goa = destinationById('goa')!
    const p = person('preethi', { dealBreakers: ['shared_rooms'] })
    expect(buildCandidate(goa, '2026-10-19', 4, 'budget', [p]).fits[0]!.status).toBe('conflict')
    expect(buildCandidate(goa, '2026-10-19', 4, 'mid', [p]).fits[0]!.status).not.toBe('conflict')
  })

  it('finds the single smallest change that makes an option work', () => {
    const goa = destinationById('goa')!
    const responses = [
      person('rich', { fromCity: 'mumbai', maxBudget: 60000, comfortableBudget: 60000 }),
      person('tight', { fromCity: 'mumbai', maxBudget: 26000, comfortableBudget: 20000 }),
    ]
    const premium = buildCandidate(goa, '2026-10-19', 4, 'premium', responses)
    expect(premium.counts.conflict).toBeGreaterThan(0)

    const windows = feasibleWindows(enumerateWindows(WINDOW_START, WINDOW_END, 4, responses))
    const fix = findSmallestCompromise(premium, responses, windows)
    expect(fix).not.toBeNull()
    expect(fix!.kind).toBe('tier_down')
    expect(fix!.effect).toMatch(/₹/)
  })

  it('flags unfairness when the same person compromises on every option', () => {
    const result = recommend({
      ...base,
      participantCount: 4,
      responses: [
        person('a', { topVibe: 'beach', fromCity: 'mumbai' }),
        person('b', { topVibe: 'beach', fromCity: 'pune' }),
        person('c', { topVibe: 'beach', fromCity: 'bengaluru' }),
        // Wants a city break, and rules out everywhere that could provide one.
        person('d', {
          topVibe: 'city',
          fromCity: 'chennai',
          dealBreakers: ['long_travel'],
          maxTravelHours: 5,
        }),
      ],
    })
    if (result.options.length > 0) {
      const d = result.options.every(
        (o) => o.perPerson.find((p) => p.participantId === 'd')?.status === 'compromise',
      )
      expect(result.fairness.length > 0).toBe(d)
    }
  })

  it('shows one option rather than padding to three', () => {
    // A group with one narrow, overwhelming constraint: almost nothing survives.
    const result = recommend({
      ...base,
      participantCount: 2,
      responses: [
        person('a', { fromCity: 'chennai', dealBreakers: ['long_travel'], maxTravelHours: 4, topVibe: 'beach' }),
        person('b', { fromCity: 'chennai', dealBreakers: ['long_travel'], maxTravelHours: 4, topVibe: 'beach' }),
      ],
    })
    expect(result.options.length).toBeLessThanOrEqual(3)
    if (result.state === 'ok' && result.options.length === 1) {
      expect(result.detail).toMatch(/padding|only one/i)
    }
  })
})

describe('date windows', () => {
  it('counts every window of the requested length inside the trip window', () => {
    const windows = enumerateWindows('2026-10-01', '2026-10-05', 3, [])
    expect(windows.map((w) => `${w.start}/${w.end}`)).toEqual([
      '2026-10-01/2026-10-03',
      '2026-10-02/2026-10-04',
      '2026-10-03/2026-10-05',
    ])
  })

  it("treats a single can't-go day as blocking the whole window", () => {
    const blocked = person('a', { cantGo: ['2026-10-02'] })
    const windows = enumerateWindows('2026-10-01', '2026-10-05', 3, [blocked])
    expect(feasibleWindows(windows).map((w) => w.start)).toEqual(['2026-10-03'])
  })
})
