import 'server-only'
import { cookies } from 'next/headers'
import { cookieName, issueToken, readToken } from '@/lib/auth'

const YEAR = 60 * 60 * 24 * 365

export async function currentParticipantId(tripId: string): Promise<string | null> {
  const jar = await cookies()
  return readToken(jar.get(cookieName(tripId))?.value, tripId)
}

export async function signInAs(tripId: string, participantId: string): Promise<void> {
  const jar = await cookies()
  jar.set(cookieName(tripId), issueToken(tripId, participantId), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: YEAR,
    secure: process.env.NODE_ENV === 'production',
  })
}

export async function signOutOf(tripId: string): Promise<void> {
  const jar = await cookies()
  jar.delete(cookieName(tripId))
}
