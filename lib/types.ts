import type { ISODate } from './dates'

/* ------------------------------------------------------------------ vibes */

export const VIBES = [
  'beach', 'mountains', 'nature', 'city',
  'nightlife', 'food', 'adventure', 'culture',
  'relaxation', 'wellness',
] as const
export type Vibe = (typeof VIBES)[number]

export const VIBE_LABELS: Record<Vibe, string> = {
  beach: 'Beach',
  mountains: 'Mountains',
  nature: 'Nature',
  city: 'City',
  nightlife: 'Nightlife',
  food: 'Food',
  adventure: 'Adventure',
  culture: 'Culture',
  relaxation: 'Relaxation',
  wellness: 'Wellness',
}

/* ------------------------------------------------------------------ cities */

export const CITIES = [
  'mumbai', 'delhi', 'bengaluru', 'pune',
  'chennai', 'hyderabad', 'kolkata',
] as const
export type City = (typeof CITIES)[number]

export const CITY_LABELS: Record<City, string> = {
  mumbai: 'Mumbai',
  delhi: 'Delhi',
  bengaluru: 'Bengaluru',
  pune: 'Pune',
  chennai: 'Chennai',
  hyderabad: 'Hyderabad',
  kolkata: 'Kolkata',
}

/* ----------------------------------------------------------- deal-breakers */

export const DEAL_BREAKERS = [
  'overnight_travel',
  'long_travel',
  'shared_rooms',
  'hostels',
  'needs_nightlife',
  'very_early_flights',
  'long_road_journeys',
  'no_flights',
] as const
export type DealBreakerId = (typeof DEAL_BREAKERS)[number]

export const DEAL_BREAKER_LABELS: Record<DealBreakerId, string> = {
  overnight_travel: 'Overnight travel',
  long_travel: 'Travel over a set number of hours',
  shared_rooms: 'Sharing a room',
  hostels: 'Hostels',
  needs_nightlife: 'Somewhere with no nightlife at all',
  very_early_flights: 'Flights before 6am',
  long_road_journeys: 'Long road journeys (over 8 hrs)',
  no_flights: "Flying (I won't fly)",
}

/** Third-person phrasing for group-facing copy, which never names a person. */
export const DEAL_BREAKER_CONSTRAINT: Record<DealBreakerId, string> = {
  overnight_travel: 'no overnight travel',
  long_travel: 'a travel-time limit',
  shared_rooms: 'no shared rooms',
  hostels: 'no hostels',
  needs_nightlife: 'somewhere with nightlife',
  very_early_flights: 'no flights before 6am',
  long_road_journeys: 'no long road journeys',
  no_flights: 'no flying',
}

/** "two participants ruled out overnight travel" — group-facing, no names. */
export const DEAL_BREAKER_GROUP_NOTE: Record<DealBreakerId, string> = {
  overnight_travel: 'ruled out overnight travel',
  long_travel: 'set a hard limit on travel time',
  shared_rooms: 'ruled out sharing a room',
  hostels: 'ruled out hostels',
  needs_nightlife: 'will not go somewhere with no nightlife at all',
  very_early_flights: 'ruled out flights before 6am',
  long_road_journeys: 'ruled out long road journeys',
  no_flights: 'will not fly',
}

/* ------------------------------------------------------- deeper-pass enums */

export const PACES = ['relaxed', 'balanced', 'packed'] as const
export type Pace = (typeof PACES)[number]
export const PACE_LABELS: Record<Pace, string> = {
  relaxed: 'Relaxed',
  balanced: 'A bit of both',
  packed: 'Packed',
}

export const STAY_TIERS = ['budget', 'mid', 'premium'] as const
export type StayTier = (typeof STAY_TIERS)[number]
export const STAY_TIER_LABELS: Record<StayTier, string> = {
  budget: 'Hostels & budget stays',
  mid: 'Mid-range hotels',
  premium: 'Premium hotels & villas',
}
export const STAY_TIER_SHORT: Record<StayTier, string> = {
  budget: 'Budget stay',
  mid: 'Mid-range stay',
  premium: 'Premium stay',
}

export const COMFORT_LEVELS = ['hostel', 'budget', 'midrange', 'premium', 'villa'] as const
export type ComfortLevel = (typeof COMFORT_LEVELS)[number]
export const COMFORT_LABELS: Record<ComfortLevel, string> = {
  hostel: 'Hostel',
  budget: 'Budget hotel',
  midrange: 'Mid-range hotel',
  premium: 'Premium hotel',
  villa: 'Private villa',
}
/** The lowest stay tier each comfort level is happy with. */
export const COMFORT_MIN_TIER: Record<ComfortLevel, StayTier> = {
  hostel: 'budget',
  budget: 'budget',
  midrange: 'mid',
  premium: 'premium',
  villa: 'premium',
}

export const PRIORITIES = [
  'cost', 'travel_time', 'destination', 'food',
  'nightlife', 'nature', 'time_together', 'comfort',
] as const
export type Priority = (typeof PRIORITIES)[number]
export const PRIORITY_LABELS: Record<Priority, string> = {
  cost: 'Keeping the cost down',
  travel_time: 'Short travel time',
  destination: 'The destination itself',
  food: 'Good food',
  nightlife: 'Nightlife',
  nature: 'Nature and outdoors',
  time_together: 'Time together as a group',
  comfort: 'Comfortable stay',
}

export const FLEXIBILITIES = ['very', 'somewhat', 'not_very'] as const
export type Flexibility = (typeof FLEXIBILITIES)[number]
export const FLEXIBILITY_LABELS: Record<Flexibility, string> = {
  very: "Very flexible — I'll go with the group",
  somewhat: 'Somewhat flexible',
  not_very: 'Not very — my answers are my answers',
}

/* --------------------------------------------------------- the preferences */

export type DayState = 'can' | 'prefer' | 'cant'

/**
 * One participant's submitted preferences.
 *
 * Every field belongs to exactly one tier of the preference model:
 *   hard constraint  - cantGo, maxBudget, dealBreakers, maxTravelHours
 *   strong preference - topVibe, comfortableBudget, preferDates, pace
 *   nice to have     - otherVibes, comfortLevel, priorities beyond the first
 */
export interface Preferences {
  /** Hard: explicit "can't go" days. */
  cantGo: ISODate[]
  /** Strong: days actively preferred. */
  preferDates: ISODate[]
  fromCity: City
  /** Hard: all-in ceiling per person, including travel from their city. */
  maxBudget: number
  /** Strong: what they're comfortable spending. Defaults to maxBudget. */
  comfortableBudget: number
  /** Strong: the one vibe that matters most. */
  topVibe: Vibe
  /** Nice to have: up to two more. */
  otherVibes: Vibe[]
  /** Hard: things they genuinely won't compromise on. */
  dealBreakers: DealBreakerId[]
  /** Hard, paired with the `long_travel` deal-breaker. */
  maxTravelHours: number | null
  dealBreakerNote: string | null

  // Optional deeper pass.
  pace: Pace | null
  comfortLevel: ComfortLevel | null
  priorities: Priority[]
  flexibility: Flexibility | null
}

export interface ParticipantResponse {
  participantId: string
  name: string
  preferences: Preferences
}

/* -------------------------------------------------------------- the option */

export type FitStatus = 'strong' | 'good' | 'compromise' | 'conflict'

export const FIT_LABELS: Record<FitStatus, string> = {
  strong: 'Strong fit',
  good: 'Good fit',
  compromise: 'Compromise',
  conflict: 'Conflict',
}

export type TravelMode = 'flight' | 'train' | 'road'

export const TRAVEL_MODE_LABELS: Record<TravelMode, string> = {
  flight: 'Flight',
  train: 'Train',
  road: 'Road',
}
