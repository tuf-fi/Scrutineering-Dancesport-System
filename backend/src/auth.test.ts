import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SAMPLE_PASSWORD } from './db/seed.ts'
import { startTestApp, type TestApp } from './testing.ts'

let app: TestApp
beforeEach(async () => {
  app = await startTestApp()
})
afterEach(() => app.close())

const post = (url: string, payload: object) => app.app.inject({ method: 'POST', url, payload })

describe('staff sign-in', () => {
  it('signs in, sets an httpOnly cookie and knows who the session is', async () => {
    const res = await post('/api/auth/staff', { username: 'admin', password: SAMPLE_PASSWORD })
    expect(res.statusCode).toBe(200)
    const cookie = String(res.headers['set-cookie'])
    expect(cookie).toMatch(/bis_session=/)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect(cookie).not.toMatch(/Secure/i)
    expect(res.json().data).toMatchObject({ role: 'admin', name: 'Amelia Rosales' })
    expect(await app.me(cookie.split(';')[0]!)).toMatchObject({ role: 'admin' })
  })

  it('gives the same answer for a wrong password and an unknown user', async () => {
    const wrong = await post('/api/auth/staff', { username: 'admin', password: 'nope' })
    const unknown = await post('/api/auth/staff', { username: 'nobody', password: 'nope' })
    expect(wrong.statusCode).toBe(401)
    expect(unknown.statusCode).toBe(401)
    expect(wrong.json().error).toBe(unknown.json().error)
  })

  it('is case-insensitive for the username only', async () => {
    expect((await post('/api/auth/staff', { username: ' Admin ', password: SAMPLE_PASSWORD })).statusCode).toBe(200)
    expect((await post('/api/auth/staff', { username: 'admin', password: SAMPLE_PASSWORD.toUpperCase() })).statusCode).toBe(401)
  })

  it('stores only a hash of the password', () => {
    const rows = app.sqlite.prepare('select password_hash as h from staff_users').all() as Array<{ h: string }>
    expect(rows.length).toBeGreaterThan(0)
    for (const { h } of rows) {
      expect(h.startsWith('scrypt$')).toBe(true)
      expect(h).not.toContain(SAMPLE_PASSWORD)
    }
  })

  it('stops after too many wrong attempts, even with the right password', async () => {
    for (let i = 0; i < 8; i++) expect((await post('/api/auth/staff', { username: 'admin', password: 'bad' })).statusCode).toBe(401)
    const blocked = await post('/api/auth/staff', { username: 'admin', password: SAMPLE_PASSWORD })
    expect(blocked.statusCode).toBe(429)
    // Another person is not affected
    expect((await post('/api/auth/staff', { username: 'mc', password: SAMPLE_PASSWORD })).statusCode).toBe(200)
  })

  it('signs out', async () => {
    const cookie = await app.signIn.staff('admin')
    const res = await app.app.inject({ method: 'POST', url: '/api/auth/sign-out', headers: { cookie } })
    expect(res.statusCode).toBe(200)
    expect(String(res.headers['set-cookie'])).toMatch(/bis_session=;/)
  })

  it('refuses a forged or tampered cookie', async () => {
    const cookie = await app.signIn.staff('mc')
    const [name, token] = cookie.split('=')
    const payload = token!.split('.')
    const forged = `${name}=${payload[0]}.${Buffer.from(JSON.stringify({ id: 'staff-admin', name: 'x', role: 'admin' })).toString('base64url')}.${payload[2]}`
    expect(await app.me(forged)).toBeNull()
    expect((await app.call('getStaffUsers', [], forged)).status).toBe(401)
  })
})

describe('accounts changing', () => {
  it('stops a deleted account at once', async () => {
    const admin = await app.signIn.staff('admin')
    const created = await app.ok<{ user: { id: string }; tempPassword: string }>('createStaffUser', [{ name: 'Temp Person', username: 'temp', role: 'mc' }], admin)
    const temp = await app.signIn.staff('temp', created.tempPassword)
    expect((await app.call('getAnnouncements', [], temp)).status).toBe(200)
    await app.ok('deleteStaffUser', [created.user.id], admin)
    expect(await app.me(temp)).toBeNull()
    expect((await app.call('getAnnouncements', [], temp)).status).toBe(401)
  })

  it('gives a new temporary password that replaces the old one', async () => {
    const admin = await app.signIn.staff('admin')
    const users = await app.ok<Array<{ id: string; username: string }>>('getStaffUsers', [], admin)
    const mc = users.find((u) => u.username === 'mc')!
    const { tempPassword } = await app.ok<{ tempPassword: string }>('resetStaffPassword', [mc.id], admin)
    expect(tempPassword).toHaveLength(10)
    expect((await post('/api/auth/staff', { username: 'mc', password: SAMPLE_PASSWORD })).statusCode).toBe(401)
    expect((await post('/api/auth/staff', { username: 'mc', password: tempPassword })).statusCode).toBe(200)
  })

  it('keeps at least one admin', async () => {
    const admin = await app.signIn.staff('admin')
    const users = await app.ok<Array<{ id: string; username: string }>>('getStaffUsers', [], admin)
    const self = users.find((u) => u.username === 'admin')!
    expect((await app.call('deleteStaffUser', [self.id], admin)).error).toMatch(/own account/)
    expect((await app.call('updateStaffUser', [self.id, { name: 'Amelia', role: 'mc' }], admin)).error).toMatch(/at least one admin/)
  })

  it('refuses to make a staff account with a club or adjudicator role', async () => {
    const admin = await app.signIn.staff('admin')
    const reply = await app.call('createStaffUser', [{ name: 'X Y', username: 'xy', role: 'club' }], admin)
    expect(reply.status).toBe(400)
  })
})

describe('adjudicator PIN sign-in', () => {
  it('signs in with a PIN for the current competition', async () => {
    const res = await post('/api/auth/adjudicator', { pin: '4100' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ role: 'adjudicator', letter: 'A' })
  })

  it('refuses an unknown PIN and limits guessing', async () => {
    expect((await post('/api/auth/adjudicator', { pin: '0000' })).statusCode).toBe(401)
    for (let i = 0; i < 7; i++) await post('/api/auth/adjudicator', { pin: String(1000 + i) })
    expect((await post('/api/auth/adjudicator', { pin: '4100' })).statusCode).toBe(429)
  })

  it('stops working when the admin changes the PIN', async () => {
    const admin = await app.signIn.staff('admin')
    const competition = (await app.ok<Array<{ id: string }>>('getCompetitions', [], admin)).find((c) => c.id === 'comp-sorsogon-2026')!
    await app.ok('generatePins', [competition.id, 'adj-a'], admin)
    expect((await post('/api/auth/adjudicator', { pin: '4100' })).statusCode).toBe(401)
    const pins = await app.ok<Array<{ adjudicatorId: string; pin: string }>>('getAdjudicatorPins', [competition.id], admin)
    const fresh = pins.find((p) => p.adjudicatorId === 'adj-a')!.pin
    expect(fresh).toMatch(/^\d{4}$/)
    expect((await post('/api/auth/adjudicator', { pin: fresh })).statusCode).toBe(200)
    // PINs stay unique within the competition
    expect(new Set(pins.map((p) => p.pin)).size).toBe(pins.length)
  })
})

describe('club accounts', () => {
  const club = { name: 'Bulan Dance Studio', contactName: 'Ana Reyes', contactEmail: 'ana@bulan.example', contactPhone: '0917 111 2222', password: 'long-enough-1', agreed: true }

  it('signs up, signs in and only sees its own club', async () => {
    const signup = await post('/api/auth/club-signup', club)
    expect(signup.statusCode).toBe(200)
    expect(signup.json().data).toMatchObject({ role: 'club', name: 'Bulan Dance Studio' })
    const cookie = await app.signIn.club('ANA@bulan.example', club.password)
    expect(await app.ok('getClubDancers', [], cookie)).toEqual([])
    const other = await app.signIn.club((await app.ok<Array<{ contactEmail: string }>>('getClubs', [], await app.signIn.staff('admin')))[0]!.contactEmail)
    const dancers = await app.ok<Array<{ id: string }>>('getClubDancers', [], other)
    expect(dancers.length).toBeGreaterThan(0)
    // Another club's dancer cannot be edited
    const edit = await app.call('saveClubDancer', [{ names: ['Hijack'], ageGroup: 'adult' }, dancers[0]!.id], cookie)
    expect(edit.status).toBe(403)
  })

  it('refuses a short password, a bad email and a repeated email or name', async () => {
    expect((await post('/api/auth/club-signup', { ...club, password: 'short' })).statusCode).toBe(400)
    expect((await post('/api/auth/club-signup', { ...club, contactEmail: 'not-an-email' })).statusCode).toBe(400)
    await post('/api/auth/club-signup', club)
    expect((await post('/api/auth/club-signup', { ...club, name: 'Another Name' })).statusCode).toBe(409)
    expect((await post('/api/auth/club-signup', { ...club, contactEmail: 'b@bulan.example' })).statusCode).toBe(409)
  })
})
