import 'server-only'
import { asc, eq } from 'drizzle-orm'
import { db, participants, responses } from '@/lib/db'
import { id } from '@/lib/ids'
import { createTrip } from '@/lib/trips'
import {
  DEMO_PARTIAL_IDS, DEMO_SEEDS, DEMO_TRIP_DAYS, DEMO_WINDOW_END, DEMO_WINDOW_START, demoResponse,
} from './scenario'

/** Deeper-pass answers for a few people, so the optional step is visible. */
const DEEPER: Record<string, Record<string, unknown>> = {
  riya: {
    pace: 'balanced', comfortLevel: 'midrange',
    priorities: ['time_together', 'destination'], flexibility: 'somewhat',
  },
  karan: {
    pace: 'relaxed', comfortLevel: 'budget',
    priorities: ['cost', 'travel_time'], flexibility: 'somewhat',
  },
  siddharth: {
    pace: 'packed', comfortLevel: 'midrange',
    priorities: ['destination', 'nature'], flexibility: 'very',
  },
}

async function seedOne(name: string, respondingIds: string[], responseDeadline: string | null) {
  const trip = await createTrip(
    {
      name,
      windowStart: DEMO_WINDOW_START,
      windowEnd: DEMO_WINDOW_END,
      tripLengthDays: DEMO_TRIP_DAYS,
      responseDeadline,
      participantNames: DEMO_SEEDS.map((s) => s.name),
    },
    true,
  )

  // Participants are created in DEMO_SEEDS order, so position lines them up.
  const created = await db.select().from(participants)
    .where(eq(participants.tripId, trip.id))
    .orderBy(asc(participants.position))

  const now = Date.now()
  for (const [index, seed] of DEMO_SEEDS.entries()) {
    if (!respondingIds.includes(seed.id)) continue
    const participant = created[index]
    if (!participant) continue
    const deeper = DEEPER[seed.id] ?? {}
    await db.insert(responses).values({
      id: id(),
      tripId: trip.id,
      participantId: participant.id,
      status: 'submitted',
      step: 6,
      data: JSON.stringify({ ...demoResponse(seed).preferences, ...deeper }),
      deeperDone: Object.keys(deeper).length > 0,
      submittedAt: now,
      updatedAt: now,
    })
  }

  return trip
}

export interface DemoTrip {
  inviteCode: string
  organizerCode: string
  name: string
}

export interface DemoTrips {
  complete: DemoTrip
  partial: DemoTrip
}

/** Creates both demo trips fresh, so the demo always starts from a clean state. */
export async function seedDemo(): Promise<DemoTrips> {
  const complete = await seedOne('Goa? Gokarna? Somewhere.', DEMO_SEEDS.map((s) => s.id), '2026-09-28')
  const partial = await seedOne('The one we keep not booking', DEMO_PARTIAL_IDS, '2026-09-30')
  const pick = (t: typeof complete): DemoTrip => ({
    inviteCode: t.inviteCode, organizerCode: t.organizerCode, name: t.name,
  })
  return { complete: pick(complete), partial: pick(partial) }
}
