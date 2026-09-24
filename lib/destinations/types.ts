import type { City, StayTier, TravelMode, Vibe } from '@/lib/types'

export interface Route {
  mode: TravelMode
  /** Approximate door-to-door hours, one way. */
  hours: number
  /** Approximate return fare per person, in rupees. */
  cost: number
  /** True when the practical version of this route travels through the night. */
  overnight: boolean
  /** True when the usable departures are before 6am. */
  earlyDeparture: boolean
  note: string
}

export type NightlifeLevel = 'none' | 'some' | 'strong'
export type SeasonRating = 'excellent' | 'good' | 'fair' | 'poor'

export interface Destination {
  id: string
  name: string
  region: string
  blurb: string
  /** Ordered: the first entry is the destination's dominant vibe. */
  vibes: Vibe[]
  nightlife: NightlifeLevel
  /** Approximate per-person, per-night spend: stay + food + getting around. */
  dailyCost: Record<StayTier, number>
  stayTypes: Record<StayTier, string>
  /** The shortest and longest trip this place is actually worth. */
  idealDays: [number, number]
  bestMonths: number[]
  octoberRating: SeasonRating
  octoberNote: string
  routes: Record<City, Route[]>
}

/**
 * The app only ever reads destinations through this interface, so the curated
 * local dataset can be swapped for a real supplier later without touching the
 * recommendation engine.
 */
export interface DestinationSource {
  all(): Destination[]
  byId(id: string): Destination | undefined
}
