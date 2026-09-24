import { describe, expect, it } from 'vitest'
import { cookieName, issueToken, readToken } from '@/lib/auth'

describe('participant tokens', () => {
  const trip = 'trip-1'
  const other = 'trip-2'
  const participant = 'karan'

  it('round-trips a participant on the trip it was issued for', () => {
    expect(readToken(issueToken(trip, participant), trip)).toBe(participant)
  })

  it('rejects a token issued for a different trip', () => {
    expect(readToken(issueToken(other, participant), trip)).toBeNull()
  })

  it('rejects a token whose participant has been swapped', () => {
    const token = issueToken(trip, participant)
    const [tripId, , signature] = token.split('.')
    expect(readToken(`${tripId}.riya.${signature}`, trip)).toBeNull()
  })

  it('rejects a tampered signature', () => {
    const token = issueToken(trip, participant)
    const [tripId, participantId, signature] = token.split('.') as [string, string, string]
    const flipped = signature.slice(0, -1) + (signature.endsWith('a') ? 'b' : 'a')
    expect(readToken(`${tripId}.${participantId}.${flipped}`, trip)).toBeNull()
  })

  it('rejects malformed and missing tokens', () => {
    expect(readToken(undefined, trip)).toBeNull()
    expect(readToken('', trip)).toBeNull()
    expect(readToken('garbage', trip)).toBeNull()
    expect(readToken('a.b', trip)).toBeNull()
    expect(readToken('a.b.c.d', trip)).toBeNull()
  })

  it('scopes the cookie to one trip, so identities cannot leak between them', () => {
    expect(cookieName(trip)).not.toBe(cookieName(other))
  })
})

describe('the signing secret', () => {
  it('refuses to fall back to a known key in production', () => {
    const previousEnv = process.env.NODE_ENV
    const previousSecret = process.env.TRIPTOGETHER_SECRET
    // What a misconfigured deployment actually looks like. The app has to fail
    // loudly rather than sign tokens everyone can forge.
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production', configurable: true, writable: true, enumerable: true,
    })
    delete process.env.TRIPTOGETHER_SECRET

    try {
      expect(() => issueToken('trip', 'person')).toThrow(/TRIPTOGETHER_SECRET is not set/)
    } finally {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: previousEnv, configurable: true, writable: true, enumerable: true,
      })
      if (previousSecret !== undefined) process.env.TRIPTOGETHER_SECRET = previousSecret
    }
  })

  it('still works without configuration outside production', () => {
    const previousSecret = process.env.TRIPTOGETHER_SECRET
    delete process.env.TRIPTOGETHER_SECRET
    try {
      expect(readToken(issueToken('trip', 'person'), 'trip')).toBe('person')
    } finally {
      if (previousSecret !== undefined) process.env.TRIPTOGETHER_SECRET = previousSecret
    }
  })
})
