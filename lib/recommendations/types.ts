import type { ISODate } from '@/lib/dates'
import type { Destination, Route } from '@/lib/destinations'
import type {
  City, DealBreakerId, FitStatus, ParticipantResponse, StayTier, Vibe,
} from '@/lib/types'

export interface EngineInput {
  responses: ParticipantResponse[]
  /** Everyone invited, including people who have not responded yet. */
  participantCount: number
  windowStart: ISODate
  windowEnd: ISODate
  tripLengthDays: number
}

export type IssueKind =
  | 'cant_go'
  | 'no_route'
  | 'over_max_budget'
  | 'stay_ruled_out'
  | 'needs_nightlife'
  | 'over_comfortable_budget'
  | 'vibe_missed'
  | 'vibe_partial'
  | 'vibe_secondary_missed'
  | 'long_travel'
  | 'overnight'
  | 'comfort_below'
  | 'season'
  | 'trip_length'
  | 'pace'

export type IssueSeverity = 'hard' | 'major' | 'minor'

export interface Issue {
  kind: IssueKind
  severity: IssueSeverity
  /** Addressed to the person it belongs to: "₹2,600 above your comfortable budget". */
  personal: string
  /** Group-facing and never names anyone: "above one participant's maximum budget". */
  constraint: string
}

export interface Plus {
  kind: 'top_vibe' | 'other_vibe' | 'under_budget' | 'preferred_dates' | 'short_travel' | 'nightlife'
  personal: string
}

export interface PersonFit {
  participantId: string
  name: string
  status: FitStatus
  /** The single line shown next to their name in the alignment matrix. */
  mainReason: string
  issues: Issue[]
  pluses: Plus[]
  /** All-in estimate for this person: stay and local spend plus their travel. */
  cost: number
  travelCost: number
  route: Route | null
  routeLabel: string
  fromCity: City
}

export interface OptionCounts {
  strong: number
  good: number
  compromise: number
  conflict: number
}

export interface OptionScores {
  coverage: number
  severity: number
  preferredDates: number
  season: number
  total: number
}

export type OptionRole = 'best' | 'lowest_friction' | 'different_vibe'

export interface Compromise {
  /** What to change, in plain words. */
  change: string
  /** What it buys you. */
  effect: string
  kind: 'tier_down' | 'tier_up' | 'shift_dates' | 'shorter_trip'
}

export interface Explanation {
  whyThis: string
  whoItSuits: string
  whoHasConcerns: string
  tradeOff: string
  canItBeSolved: string
}

export interface TripOption {
  id: string
  role: OptionRole | null
  destination: Destination
  start: ISODate
  end: ISODate
  days: number
  nights: number
  tier: StayTier
  costLow: number
  costHigh: number
  perPerson: PersonFit[]
  counts: OptionCounts
  scores: OptionScores
  viable: boolean
  smallestCompromise: Compromise | null
  explanation: Explanation
}

export interface WhyNot {
  destinationId: string
  name: string
  /** "Fits the beach preference, but travel cost exceeds two participants' maximum budgets." */
  reason: string
}

export interface GroupBoundaries {
  /** Windows of the requested length that work for everyone who has responded. */
  workableWindows: { start: ISODate; end: ISODate }[]
  /** The lowest maximum budget in the group — the real ceiling. */
  budgetCeiling: number
  budgetCeilingIsBinding: boolean
  sharedVibes: Vibe[]
  splitVibes: Vibe[]
  hardNos: { id: DealBreakerId; label: string; count: number }[]
  notes: string[]
}

export interface FairnessFlag {
  participantId: string
  name: string
  /** Group-facing: names the preference, not the person. */
  constraint: string
  /** Personal: named, for the organizer view. */
  detail: string
}

export type ResultState =
  | 'waiting'          // fewer than two responses
  | 'no_date_overlap'
  | 'no_budget_overlap'
  | 'none_viable'
  | 'ok'

export interface DateFix {
  start: ISODate
  end: ISODate
  days: number
  description: string
}

export interface Recommendation {
  state: ResultState
  headline: string
  detail: string
  options: TripOption[]
  whyNot: WhyNot[]
  boundaries: GroupBoundaries
  fairness: FairnessFlag[]
  /** Present when there is no window that works for everyone. */
  dateFix: DateFix | null
  respondedCount: number
  participantCount: number
}
