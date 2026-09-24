import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Participants are identified by a signed cookie, not an account. The token
 * says "this browser is Karan on this trip" and nothing else; it carries no
 * privileges beyond that and cannot be edited into someone else's identity
 * without the secret.
 */
const DEV_FALLBACK = 'triptogether-dev-secret'

function secret(): string {
  const configured = process.env.TRIPTOGETHER_SECRET
  if (configured && configured.length > 0) return configured

  // A predictable signing key means anyone can forge an identity on any trip.
  // Tolerable on a laptop, never in production.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'TRIPTOGETHER_SECRET is not set. Generate one with:\n'
      + '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"',
    )
  }
  return DEV_FALLBACK
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function issueToken(tripId: string, participantId: string): string {
  const payload = `${tripId}.${participantId}`
  return `${payload}.${sign(payload)}`
}

export function readToken(token: string | undefined, tripId: string): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [tokenTripId, participantId, signature] = parts as [string, string, string]
  if (tokenTripId !== tripId) return null

  const expected = Buffer.from(sign(`${tokenTripId}.${participantId}`))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length) return null
  if (!timingSafeEqual(expected, actual)) return null
  return participantId
}

export function cookieName(tripId: string): string {
  return `tt_${tripId}`
}
