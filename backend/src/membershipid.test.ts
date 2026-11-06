import type { Coach, AthleteRow } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { startTestApp, type TestApp } from './testing.ts'

// A membership ID is given once, the first time the fee is paid, and signs an athlete or coach in like an email does

let app: TestApp
let secretariat = ''
const SHOT = 'data:image/png;base64,iVBORw0KGgo='

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  app.db.insert(t.staffUsers).values({ id: 's2', name: 'secretariat', username: 'secretariat@sample.example', role: 'secretariat', passwordHash: hashPassword('pw-secretariat'), disabled: false }).run()
  secretariat = await app.signIn.staff('secretariat', 'pw-secretariat')
})
afterAll(() => app.close())

describe('athlete membership IDs', () => {
  it('has none until the first membership is confirmed, then keeps it', async () => {
    const athlete = await app.signIn.athleteSignUp('Ana Cruz', 'ana@test.example', 'a-long-password')
    expect((await app.ok<AthleteRow[]>('getAthletes', [], secretariat))[0]).toMatchObject({ name: 'Ana Cruz', membershipId: null })

    await app.ok('requestMembership', [{ method: 'GCash', receipt: SHOT }], athlete)
    const [row] = await app.ok<AthleteRow[]>('getAthletes', [], secretariat)
    await app.ok('confirmMembership', [row!.id], secretariat)
    expect((await app.ok<AthleteRow[]>('getAthletes', [], secretariat))[0]).toMatchObject({ membershipId: 'A-00001' })

    // The next athlete's number follows, and Ana's does not change when a later year is paid
    const ben = await app.signIn.athleteSignUp('Ben Reyes', 'ben@test.example', 'a-long-password')
    await app.ok('requestMembership', [{ method: 'GCash', receipt: SHOT }], ben)
    const rows = await app.ok<AthleteRow[]>('getAthletes', [], secretariat)
    await app.ok('confirmMembership', [rows.find((r) => r.name === 'Ben Reyes')!.id], secretariat)
    const after = await app.ok<AthleteRow[]>('getAthletes', [], secretariat)
    expect(after.find((r) => r.name === 'Ben Reyes')?.membershipId).toBe('A-00002')
    expect(after.find((r) => r.name === 'Ana Cruz')?.membershipId).toBe('A-00001')
  })

  it('signs in with the ID or the email, in any case', async () => {
    expect(await app.signIn.athlete('A-00001', 'a-long-password')).toContain('=')
    expect(await app.signIn.athlete(' a-00001 ', 'a-long-password')).toContain('=')
    expect(await app.signIn.athlete('ana@test.example', 'a-long-password')).toContain('=')
    await expect(app.signIn.athlete('A-00001', 'wrong-password')).rejects.toThrow(/Wrong email or password/)
    await expect(app.signIn.athlete('A-99999', 'a-long-password')).rejects.toThrow(/Wrong email or password/)
  })
})

describe('coach membership IDs and summits', () => {
  it('gives the ID when the membership is first recorded, and keeps the summits newest first', async () => {
    const unpaid = await app.ok<Coach>('saveCoach', [{ name: 'Coach Lito', email: '', phone: '', memberYear: null, summitYear: null }], secretariat)
    expect(unpaid.membershipId).toBeNull()
    const paid = await app.ok<Coach>('saveCoach', [{ name: 'Coach Lito', email: '', phone: '', memberYear: 2026, summitYear: null, summits: ['2025-03-01', '2026-05-10', '2025-03-01'] }, unpaid.id], secretariat)
    expect(paid.membershipId).toBe('C-00001')
    expect(paid.summits).toEqual(['2026-05-10', '2025-03-01'])
    const again = await app.ok<Coach>('saveCoach', [{ name: 'Coach Lito', email: '', phone: '', memberYear: 2027, summitYear: null, summits: [] }, unpaid.id], secretariat)
    expect(again.membershipId).toBe('C-00001')
    expect((await app.call('saveCoach', [{ name: 'Coach Lito', email: '', phone: '', memberYear: 2026, summitYear: null, summits: ['not a date'] }, unpaid.id], secretariat)).error).toMatch(/year-month-day/)
  })

  it('signs a linked coach in with the coach ID', async () => {
    const [coach] = await app.ok<Coach[]>('getCoaches', [], secretariat)
    app.db.insert(t.memberAccounts).values({ id: 'm-lito', role: 'coach', name: 'Coach Lito', email: 'lito@test.example', passwordHash: hashPassword('a-long-password'), linkedId: coach!.id }).run()
    expect(await app.signIn.member('coach', 'C-00001', 'a-long-password')).toContain('=')
    expect(await app.signIn.member('coach', 'lito@test.example', 'a-long-password')).toContain('=')
    // An athlete ID is not a coach ID
    await expect(app.signIn.member('coach', 'A-00001', 'a-long-password')).rejects.toThrow(/Wrong email or password/)
  })
})
