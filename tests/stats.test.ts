import { describe, expect, it } from 'vitest'
import { groupStats } from '@/lib/stats'
import {
  DEMO_WINDOW_END, DEMO_WINDOW_START, demoResponses,
} from '@/lib/demo/scenario'
import { WINDOW_END, WINDOW_START, availableOnly, person } from './helpers'

describe('group stats on the seeded scenario', () => {
  const stats = groupStats(demoResponses(), 5, DEMO_WINDOW_START, DEMO_WINDOW_END)

  it('counts the responses it was given', () => {
    expect(stats.respondedCount).toBe(5)
    expect(stats.participantCount).toBe(5)
  })

  it('finds the four days that work for all five', () => {
    // 19–22 Oct: the same window the engine picks.
    expect(stats.daysEveryoneFree).toBe(4)
    expect(stats.windowDays).toBe(31)

    const everyone = stats.coverage.filter((d) => d.free === 5).map((d) => d.date)
    expect(everyone).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'])
  })

  it('reports the binding budget ceiling, not the average', () => {
    expect(stats.budget.ceiling).toBe(25000)
    expect(stats.budget.lowest).toBe(25000)
    expect(stats.budget.highest).toBe(40000)
    expect(stats.budget.spread).toBe(15000)
    expect(stats.budget.median).toBe(30000)
  })

  it('separates top picks from the full spread of vibes', () => {
    const topBeach = stats.topVibes.find((v) => v.value === 'beach')
    expect(topBeach?.count).toBe(3)

    // Preethi's beach is a second choice, so the full tally is higher.
    const allBeach = stats.vibes.find((v) => v.value === 'beach')
    expect(allBeach?.count).toBe(4)
  })

  it('tallies every hard no', () => {
    const ids = stats.dealBreakers.map((d) => d.value).sort()
    expect(ids).toEqual(['long_travel', 'overnight_travel', 'shared_rooms'])
    expect(stats.dealBreakers.every((d) => d.count === 1)).toBe(true)
  })

  it('lists the five cities people are leaving from', () => {
    expect(stats.cities.map((c) => c.value).sort()).toEqual([
      'bengaluru', 'chennai', 'delhi', 'mumbai', 'pune',
    ])
  })

  it('collapses availability into readable contiguous ranges', () => {
    const riya = stats.availability.find((p) => p.name === 'Riya')!
    expect(riya.ranges).toEqual(['18–22 Oct'])
    expect(riya.daysFree).toBe(5)

    const siddharth = stats.availability.find((p) => p.name === 'Siddharth')!
    expect(siddharth.ranges).toEqual(['18–25 Oct'])
    expect(siddharth.daysFree).toBe(8)
  })

  it('counts who answered the optional deeper questions', () => {
    // Only the seeded subset has flexibility set.
    expect(stats.deeperPassCount).toBeGreaterThan(0)
    expect(stats.deeperPassCount).toBeLessThanOrEqual(5)
  })
})

describe('group stats edge cases', () => {
  it('handles nobody having responded', () => {
    const stats = groupStats([], 5, WINDOW_START, WINDOW_END)
    expect(stats.respondedCount).toBe(0)
    expect(stats.daysEveryoneFree).toBe(0)
    expect(stats.budget.ceiling).toBe(0)
    expect(stats.vibes).toEqual([])
    expect(stats.availability).toEqual([])
  })

  it('splits a broken-up availability into separate ranges', () => {
    const patchy = person('a', {
      cantGo: ['2026-10-05', '2026-10-06', ...availableOnly('2026-10-01', '2026-10-10')],
    })
    const stats = groupStats([patchy], 1, WINDOW_START, WINDOW_END)
    expect(stats.availability[0]!.ranges).toEqual(['1–4 Oct', '7–10 Oct'])
  })

  it('does not claim a day works for everyone when nobody has answered', () => {
    const stats = groupStats([], 3, WINDOW_START, WINDOW_END)
    expect(stats.coverage.every((d) => d.free === 0)).toBe(true)
    expect(stats.daysEveryoneFree).toBe(0)
  })
})
