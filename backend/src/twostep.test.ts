import type { StaffUser, TotpSetup, TotpStatus } from '@bis/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { codeFor, stepAt } from './auth/totp.ts'
import { loadConfig } from './config.ts'
import { decryptSecret, encryptLegacySecrets } from './auth/vault.ts'
import { startTestApp, type TestApp } from './testing.ts'

// Two-step sign-in: after the password, a code from an authenticator app, or a recovery code

let app: TestApp
let admin = ''
beforeEach(async () => {
  app = await startTestApp()
  admin = await app.signIn.staff('admin')
})
afterEach(async () => {
  vi.useRealTimers()
  await app.close()
})

const signIn = (username: string, password = 'bis2026', code?: string, ip = '10.0.0.1') =>
  app.app.inject({ method: 'POST', url: '/api/auth/staff', payload: { username: username.includes('@') ? username : `${username}@sample.example`, password, ...(code === undefined ? {} : { code }) }, remoteAddress: ip })

// The code the app would show now; each call moves the clock on, so a code is never the same step twice
let clock = Date.UTC(2026, 9, 10, 8, 0, 0)
const nextCode = (secret: string) => {
  clock += 31_000
  vi.setSystemTime(clock)
  return codeFor(secret, stepAt(clock))
}

async function turnOn(cookie: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clock)
  const setup = await app.ok<TotpSetup>('startTotpSetup', [], cookie)
  const done = await app.ok<{ recoveryCodes: string[] }>('confirmTotpSetup', [nextCode(setup.secret)], cookie)
  return { secret: setup.secret, recovery: done.recoveryCodes }
}

describe('turning it on', () => {
  it('gives a secret and an address for an authenticator app, and asks for nothing at sign-in until confirmed', async () => {
    const setup = await app.ok<TotpSetup>('startTotpSetup', [], admin)
    expect(setup.secret).toMatch(/^[A-Z2-7]{32}$/)
    expect(setup.uri).toBe(`otpauth://totp/BIS%3Aadmin%40sample.example?secret=${setup.secret}&issuer=BIS&algorithm=SHA1&digits=6&period=30`)
    expect(await app.ok<TotpStatus>('getTotpStatus', [], admin)).toEqual({ enabled: false, recoveryLeft: 0 })
    expect((await signIn('admin')).statusCode).toBe(200)
  })

  it('needs a right code to turn on, and then shows eight recovery codes once', async () => {
    await app.ok('startTotpSetup', [], admin)
    expect((await app.call('confirmTotpSetup', ['000000'], admin)).status).toBe(400)
    expect((await app.call('confirmTotpSetup', ['123456'], admin)).status).toBe(400)
    const { recovery } = await turnOn(admin)
    expect(recovery).toHaveLength(8)
    expect(await app.ok<TotpStatus>('getTotpStatus', [], admin)).toEqual({ enabled: true, recoveryLeft: 8 })
    expect((await app.call('startTotpSetup', [], admin)).status).toBe(409)
    // Only hashes are kept
    const stored = app.sqlite.prepare("select totp_recovery as r from staff_users where username = 'admin@sample.example'").get() as { r: string }
    for (const code of recovery) expect(stored.r).not.toContain(code.replace('-', ''))
  })

  it('keeps the secret encrypted, never as the app shows it', async () => {
    const { secret } = await turnOn(admin)
    const stored = app.sqlite.prepare("select totp_secret as s from staff_users where username = 'admin@sample.example'").get() as { s: string }
    expect(stored.s).toMatch(/^enc1:/)
    expect(stored.s).not.toContain(secret)
  })

  it('still accepts a secret saved before encryption, and encrypts it at the next start', async () => {
    const { secret } = await turnOn(admin)
    app.sqlite.prepare("update staff_users set totp_secret = ? where username = 'admin@sample.example'").run(secret)
    expect((await signIn('admin', 'bis2026', nextCode(secret))).statusCode).toBe(200)
    expect(encryptLegacySecrets(app.db, loadConfig({}).dataKey)).toBe(1)
    const stored = app.sqlite.prepare("select totp_secret as s from staff_users where username = 'admin@sample.example'").get() as { s: string }
    expect(stored.s).toMatch(/^enc1:/)
    expect((await signIn('admin', 'bis2026', nextCode(secret))).statusCode).toBe(200)
  })

  it('refuses every code when the key is different', async () => {
    const { secret } = await turnOn(admin)
    const stored = app.sqlite.prepare("select totp_secret as s from staff_users where username = 'admin@sample.example'").get() as { s: string }
    expect(decryptSecret(stored.s, 'a-different-key-of-32-characters!!')).toBeNull()
    expect(decryptSecret(stored.s, loadConfig({}).dataKey)).toBe(secret)
  })

  it('cannot be confirmed before it is started', async () => {
    expect((await app.call('confirmTotpSetup', ['123456'], admin)).status).toBe(409)
  })
})

describe('signing in with it on', () => {
  it('asks for the code after the password, and accepts a right one', async () => {
    const { secret } = await turnOn(admin)
    const needs = await signIn('admin')
    expect(needs.statusCode).toBe(428)
    expect(needs.json().error).toMatch(/6-digit code/)
    expect((await signIn('admin', 'wrong-password', '123456')).statusCode).toBe(401)
    expect((await signIn('admin', 'bis2026', '000000')).statusCode).toBe(401)
    const ok = await signIn('admin', 'bis2026', nextCode(secret))
    expect(ok.statusCode).toBe(200)
    expect(ok.json().data).toMatchObject({ role: 'admin' })
  })

  it('refuses a code that was already used', async () => {
    const { secret } = await turnOn(admin)
    const code = nextCode(secret)
    expect((await signIn('admin', 'bis2026', code)).statusCode).toBe(200)
    expect((await signIn('admin', 'bis2026', code)).statusCode).toBe(401)
  })

  it('accepts a recovery code once, whichever way it is typed', async () => {
    const { recovery } = await turnOn(admin)
    expect((await signIn('admin', 'bis2026', recovery[0]!.toLowerCase().replace('-', ' '))).statusCode).toBe(200)
    // Using a recovery code tells the admin's open screens
    expect(app.hub.sent.filter((e) => e.event === 'alert').at(-1)?.payload).toMatchObject({ roles: ['admin'], note: { title: 'Recovery code used' } })
    expect((await signIn('admin', 'bis2026', recovery[0]!)).statusCode).toBe(401)
    expect((await signIn('admin', 'bis2026', recovery[1]!)).statusCode).toBe(200)
    expect(await app.ok<TotpStatus>('getTotpStatus', [], admin)).toEqual({ enabled: true, recoveryLeft: 6 })
  })

  it('does not touch other accounts', async () => {
    await turnOn(admin)
    expect((await signIn('scrutineer')).statusCode).toBe(200)
  })

  it('does not count asking for the code as a wrong guess, but does count a wrong code', async () => {
    await turnOn(admin)
    for (let i = 0; i < 30; i++) expect((await signIn('admin', 'bis2026', undefined, `10.1.0.${i}`)).statusCode).toBe(428)
    for (let i = 0; i < 20; i++) expect((await signIn('admin', 'bis2026', '000000', `10.2.0.${i}`)).statusCode).toBe(401)
    expect((await signIn('admin', 'bis2026', '000000', '10.2.1.1')).statusCode).toBe(429)
  })

  it('shows on the staff list', async () => {
    await turnOn(admin)
    const staff = await app.ok<StaffUser[]>('getStaffUsers', [], admin)
    expect(staff.find((s) => s.username === 'admin@sample.example')?.twoStep).toBe(true)
    expect(staff.find((s) => s.username === 'scrutineer@sample.example')?.twoStep).toBe(false)
  })
})

describe('turning it off', () => {
  it('needs the password and a code', async () => {
    const { secret } = await turnOn(admin)
    expect((await app.call('disableTotp', ['wrong', nextCode(secret)], admin)).status).toBe(400)
    expect((await app.call('disableTotp', ['bis2026', '000000'], admin)).status).toBe(400)
    await app.ok('disableTotp', ['bis2026', nextCode(secret)], admin)
    expect(await app.ok<TotpStatus>('getTotpStatus', [], admin)).toEqual({ enabled: false, recoveryLeft: 0 })
    expect((await signIn('admin')).statusCode).toBe(200)
  })

  it('is refused when it is not on', async () => {
    expect((await app.call('disableTotp', ['bis2026', '123456'], admin)).status).toBe(409)
  })
})

describe('an admin resetting it for someone who lost their phone', () => {
  it('turns it off for them and signs them out, and is for admins only', async () => {
    const scrutineer = await app.signIn.staff('scrutineer')
    const id = (await app.me(scrutineer))!.id
    await turnOn(scrutineer)
    expect((await app.call('resetTotp', [id], await app.signIn.staff('secretariat'))).status).toBe(403)
    await app.ok('resetTotp', [id], admin)
    expect(await app.me(scrutineer)).toBeNull()
    expect((await signIn('scrutineer')).statusCode).toBe(200)
    expect((await app.call('resetTotp', [id], admin)).status).toBe(409)
  })
})
