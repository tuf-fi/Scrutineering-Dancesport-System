import { describe, expect, it } from 'vitest'
import { base32Decode, base32Encode, codeFor, hashRecovery, newRecoveryCodes, newSecret, normalizeRecovery, otpauthUri, stepAt, verifyCode } from './auth/totp.ts'

// RFC 6238, Appendix B: the secret is the ASCII string 12345678901234567890
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'))

describe('one-time codes', () => {
  it('match the test vectors of RFC 6238', () => {
    const vectors: Array<[number, string]> = [
      [59, '94287082'],
      [1111111109, '07081804'],
      [1111111111, '14050471'],
      [1234567890, '89005924'],
      [2000000000, '69279037'],
    ]
    for (const [seconds, code] of vectors) expect(codeFor(RFC_SECRET, stepAt(seconds * 1000), 8)).toBe(code)
  })

  it('are six digits for an authenticator app', () => {
    expect(codeFor(RFC_SECRET, stepAt(59_000))).toBe('287082')
  })

  it('round-trips a secret through base32', () => {
    const secret = newSecret()
    expect(secret).toMatch(/^[A-Z2-7]{32}$/)
    expect(base32Encode(base32Decode(secret))).toBe(secret)
    expect(() => base32Decode('not base32!')).toThrow()
  })
})

describe('checking a typed code', () => {
  const now = 1_700_000_000_000
  const step = stepAt(now)
  const code = (s: number) => codeFor(RFC_SECRET, s)

  it('accepts the current step and the ones either side, and says which step it was', () => {
    expect(verifyCode(RFC_SECRET, code(step), 0, now)).toBe(step)
    expect(verifyCode(RFC_SECRET, code(step - 1), 0, now)).toBe(step - 1)
    expect(verifyCode(RFC_SECRET, code(step + 1), 0, now)).toBe(step + 1)
    expect(verifyCode(RFC_SECRET, ` ${code(step).slice(0, 3)} ${code(step).slice(3)} `, 0, now)).toBe(step)
  })

  it('refuses a step two away, a wrong code and something that is not six digits', () => {
    expect(verifyCode(RFC_SECRET, code(step - 2), 0, now)).toBeNull()
    expect(verifyCode(RFC_SECRET, code(step + 2), 0, now)).toBeNull()
    expect(verifyCode(RFC_SECRET, code(step) === '000000' ? '000001' : '000000', 0, now)).toBeNull()
    expect(verifyCode(RFC_SECRET, '12345', 0, now)).toBeNull()
    expect(verifyCode(RFC_SECRET, 'abcdef', 0, now)).toBeNull()
  })

  it('refuses a code for a step already used', () => {
    expect(verifyCode(RFC_SECRET, code(step), step, now)).toBeNull()
    expect(verifyCode(RFC_SECRET, code(step - 1), step, now)).toBeNull()
    expect(verifyCode(RFC_SECRET, code(step + 1), step, now)).toBe(step + 1)
  })
})

describe('the account link and recovery codes', () => {
  it('builds the address an authenticator app reads', () => {
    expect(otpauthUri('ABC234', 'admin', 'BIS')).toBe('otpauth://totp/BIS%3Aadmin?secret=ABC234&issuer=BIS&algorithm=SHA1&digits=6&period=30')
  })

  it('makes eight distinct codes without lookalike characters, and matches them however they are typed', () => {
    const codes = newRecoveryCodes()
    expect(codes).toHaveLength(8)
    expect(new Set(codes).size).toBe(8)
    for (const c of codes) expect(c).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/)
    const first = codes[0]!
    expect(hashRecovery(first.toLowerCase().replace('-', ' '))).toBe(hashRecovery(first))
    expect(normalizeRecovery(' ab-cd ')).toBe('ABCD')
  })
})
