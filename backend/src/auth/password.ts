import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

// scrypt is built into Node, so there is no native module to install on the venue laptop
const KEY_LENGTH = 64
const COST = 16384

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, KEY_LENGTH, { N: COST })
  return `scrypt$${COST}$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false
  const [scheme, cost, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !cost || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(cost) })
  return timingSafeEqual(actual, expected)
}

// Easy to read out loud and type on a phone: no 0/O or 1/l
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

export function temporaryPassword(length = 10): string {
  const bytes = randomBytes(length)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}
