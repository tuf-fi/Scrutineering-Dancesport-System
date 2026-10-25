import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto'

// Time-based one-time codes (RFC 6238) as an authenticator app makes them: HMAC-SHA1 of the 30-second step, six digits.
// Built from Node's own crypto, so there is nothing to install.

const STEP_SECONDS = 30
const DIGITS = 6
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(bytes: Buffer): string {
  let bits = ''
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0')
  let out = ''
  for (let i = 0; i < bits.length; i += 5) out += BASE32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]
  return out
}

export function base32Decode(text: string): Buffer {
  let bits = ''
  for (const char of text.replace(/=+$/, '').toUpperCase()) {
    const value = BASE32.indexOf(char)
    if (value < 0) throw new Error('Not a base32 secret.')
    bits += value.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

export const newSecret = () => base32Encode(randomBytes(20))

export const stepAt = (ms: number) => Math.floor(ms / 1000 / STEP_SECONDS)

// The code for one step; `digits` is 6 for apps, and the RFC's own test vectors use 8
export function codeFor(secret: string, step: number, digits = DIGITS): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest()
  const offset = hmac[hmac.length - 1]! & 0x0f
  const binary = ((hmac[offset]! & 0x7f) << 24) | (hmac[offset + 1]! << 16) | (hmac[offset + 2]! << 8) | hmac[offset + 3]!
  return String(binary % 10 ** digits).padStart(digits, '0')
}

// The step a typed code belongs to, within one step either side of now (a slow clock or a slow typist), and later than
// the last step already used; null when the code is wrong or was already used
export function verifyCode(secret: string, typed: string, lastStep: number, now = Date.now()): number | null {
  const code = typed.replace(/\s+/g, '')
  if (!/^\d{6}$/.test(code)) return null
  const current = stepAt(now)
  for (const step of [current, current - 1, current + 1]) {
    if (step > lastStep && codeFor(secret, step) === code) return step
  }
  return null
}

// What an authenticator app scans or is given to add the account
export const otpauthUri = (secret: string, account: string, issuer: string) =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`

// Recovery codes: for a lost phone. Ten characters without lookalikes, shown once, kept only as hashes.
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function newRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const raw = Array.from({ length: 10 }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]).join('')
    return `${raw.slice(0, 5)}-${raw.slice(5)}`
  })
}
export const normalizeRecovery = (typed: string) => typed.replace(/[\s-]/g, '').toUpperCase()
export const hashRecovery = (code: string) => createHash('sha256').update(normalizeRecovery(code)).digest('hex')
