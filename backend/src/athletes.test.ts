import type { AthletePage, AthleteProfile, AthleteRow, RegistrationQuote } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { startTestApp, type TestApp } from './testing.ts'

// An athlete makes an account, fills in their details and reports a membership payment; the secretariat confirms it

let app: TestApp
let secretariat = ''
let athlete = ''

const PROFILE = { name: 'Ana Cruz', birthDate: '2017-03-02', phone: '0917', address: 'Naga City', province: 'Camarines Sur', clubId: 'club-1', coachId: null }

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  app.db.insert(t.staffUsers).values({ id: 's2', name: 'secretariat', username: 'secretariat', role: 'secretariat', passwordHash: hashPassword('pw-secretariat'), disabled: false }).run()
  secretariat = await app.signIn.staff('secretariat', 'pw-secretariat')
  app.db.insert(t.clubs).values({ id: 'club-1', name: 'Naga Dancers', contactName: '', contactEmail: '', contactPhone: '' }).run()
  app.db.insert(t.competitions).values({ id: 'c1', name: '4th Quarter', date: '2026-12-06', venue: 'Robinsons Naga', organizer: 'BGDT' } as typeof t.competitions.$inferInsert).run()
  athlete = await app.signIn.athleteSignUp('Ana Cruz', 'Ana@Test.example', 'a-long-password')
})
afterAll(() => app.close())

describe('athlete accounts', () => {
  it('signs up, signs in with the same email in any case, and rejects a wrong password', async () => {
    expect((await app.me(athlete))?.role).toBe('athlete')
    expect(await app.signIn.athlete('ana@test.example', 'a-long-password')).toContain('=')
    await expect(app.signIn.athlete('ana@test.example', 'wrong-password')).rejects.toThrow(/Wrong email or password/)
  })

  it('refuses a duplicate email, a bad email and a short password', async () => {
    await expect(app.signIn.athleteSignUp('Other', 'ana@test.example', 'another-password')).rejects.toThrow(/already exists/)
    await expect(app.signIn.athleteSignUp('Other', 'not-an-email', 'another-password')).rejects.toThrow(/valid email/)
    await expect(app.signIn.athleteSignUp('Other', 'other@test.example', 'short')).rejects.toThrow(/at least 8/)
  })

  it('keeps the athlete to their own page', async () => {
    expect((await app.call('getAthletes', [], athlete)).status).toBe(403)
    expect((await app.call('confirmMembership', ['x'], athlete)).status).toBe(403)
    expect((await app.call('getMyAthlete', [], secretariat)).status).toBe(403)
    expect((await app.call('getMyAthlete', [])).status).toBe(401)
  })

  it('saves the details, and only for clubs that exist', async () => {
    expect((await app.call('saveMyAthlete', [{ ...PROFILE, clubId: 'nope' }], athlete)).error).toMatch(/club/)
    expect((await app.call('saveMyAthlete', [{ ...PROFILE, birthDate: '2999-01-01' }], athlete)).error).toMatch(/date of birth/)
    const saved = await app.ok<AthleteProfile>('saveMyAthlete', [PROFILE], athlete)
    expect(saved).toMatchObject({ name: 'Ana Cruz', clubId: 'club-1', memberYear: null, request: null })
    const page = await app.ok<AthletePage>('getMyAthlete', [], athlete)
    expect(page).toMatchObject({ year: 2026, fee: 500 })
  })

  it('takes a membership payment report, and the secretariat confirms it', async () => {
    expect((await app.call('requestMembership', [{ method: '', reference: '123' }], athlete)).error).toMatch(/how you paid/)
    const sent = await app.ok<AthleteProfile>('requestMembership', [{ method: 'GCash', reference: 'REF-1' }], athlete)
    expect(sent.request).toMatchObject({ year: 2026, method: 'GCash', reference: 'REF-1' })
    expect((await app.call('requestMembership', [{ method: 'GCash', reference: 'REF-2' }], athlete)).status).toBe(409)

    const [row] = await app.ok<AthleteRow[]>('getAthletes', [], secretariat)
    expect(row).toMatchObject({ name: 'Ana Cruz', clubName: 'Naga Dancers', memberYear: null })
    await app.ok('confirmMembership', [row!.id], secretariat)
    const page = await app.ok<AthletePage>('getMyAthlete', [], athlete)
    expect(page.profile).toMatchObject({ memberYear: 2026, request: null })
    expect((await app.call('requestMembership', [{ method: 'GCash', reference: 'REF-3' }], athlete)).error).toMatch(/already paid/)
  })

  it('lets the athlete send a payment again after it was turned down', async () => {
    const other = await app.signIn.athleteSignUp('Ben Reyes', 'ben@test.example', 'a-long-password')
    await app.ok('requestMembership', [{ method: 'Maya', reference: 'BAD' }], other)
    const ben = (await app.ok<AthleteRow[]>('getAthletes', [], secretariat)).find((a) => a.name === 'Ben Reyes')!
    expect((await app.call('rejectMembership', [ben.id, ' '], secretariat)).status).toBe(400)
    await app.ok('rejectMembership', [ben.id, 'No payment found for that reference'], secretariat)
    expect((await app.ok<AthletePage>('getMyAthlete', [], other)).profile.request?.rejectedReason).toMatch(/No payment/)
    expect((await app.call('confirmMembership', [ben.id], secretariat)).status).toBe(409)
    await app.ok('requestMembership', [{ method: 'Maya', reference: 'GOOD' }], other)
    expect((await app.ok<AthletePage>('getMyAthlete', [], other)).profile.request).toMatchObject({ reference: 'GOOD' })
  })

  it('signs the athlete out everywhere when the password is reset', async () => {
    const [ana] = await app.ok<AthleteRow[]>('getAthletes', [], secretariat)
    const { tempPassword } = await app.ok<{ tempPassword: string }>('resetAthletePassword', [ana!.id], secretariat)
    expect(await app.me(athlete)).toBeNull()
    expect(await app.signIn.athlete('ana@test.example', tempPassword)).toContain('=')
  })

  it('counts a membership paid on the account when pricing an entry', async () => {
    app.db.insert(t.events).values({ id: 'e1', competitionId: 'c1', number: 1, position: 1, ageGroup: 'juvenile_1', class: 'C', discipline: 'latin', dances: ['samba'], isSolo: true } as typeof t.events.$inferInsert).run()
    const details = (email: string) => ({ province: 'Camarines Sur', coachId: null, dancers: [{ birthDate: '2017-03-02', address: '', email, phone: '' }], beginner: false, memberYear: null })
    const paid = await app.ok<{ id: string }>('createCompetitor', [{ names: ['Ana Cruz'], clubId: 'club-1', details: details('ANA@test.example') }], secretariat)
    const unpaid = await app.ok<{ id: string }>('createCompetitor', [{ names: ['Cara Diaz'], clubId: 'club-1', details: details('cara@test.example') }], secretariat)
    expect((await app.ok<RegistrationQuote>('quoteRegistration', [paid.id, ['e1']], secretariat)).total).toBe(400)
    expect((await app.ok<RegistrationQuote>('quoteRegistration', [unpaid.id, ['e1']], secretariat)).total).toBe(900)
  })

  it('deletes an account', async () => {
    const rows = await app.ok<AthleteRow[]>('getAthletes', [], secretariat)
    await app.ok('deleteAthlete', [rows[0]!.id], secretariat)
    expect(await app.ok<AthleteRow[]>('getAthletes', [], secretariat)).toHaveLength(rows.length - 1)
  })
})
