import { randomBytes, randomUUID } from 'node:crypto'

/** Crockford-ish: no vowels, so no accidental words, and no 0/O or 1/I/L mixups. */
const ALPHABET = '23456789BCDFGHJKMNPQRSTVWXYZ'

export function id(): string {
  return randomUUID()
}

/**
 * Invite and organizer codes are the only thing standing between a link and a
 * trip's contents, so they are drawn from the CSPRNG at a length that is not
 * worth guessing (28^12 ≈ 2^57).
 */
export function code(length = 12): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % ALPHABET.length]
  return out
}
