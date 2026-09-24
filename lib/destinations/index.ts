import { DESTINATIONS } from './data'
import type { Destination, DestinationSource } from './types'

export type { Destination, DestinationSource, Route, NightlifeLevel, SeasonRating } from './types'

/** The curated local dataset. Swap this for a real supplier by passing a
 *  different DestinationSource into the recommendation engine. */
export const localDestinations: DestinationSource = {
  all: () => DESTINATIONS,
  byId: (id) => DESTINATIONS.find((d) => d.id === id),
}

export function destinationById(id: string): Destination | undefined {
  return localDestinations.byId(id)
}

export { DESTINATIONS }
