import type { AthleteRecord, AthleteRecordInput, MemberClaimRow } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { startTestApp, type TestApp } from './testing.ts'

// Staff add an athlete before they have an account; the athlete asks to be linked and staff decide

let app: TestApp
let secretariat = ''
let athlete = ''

const input = (over: Partial<AthleteRecordInput> = {}): AthleteRecordInput => ({
  name: 'Ana Cruz',
  birthDate: '2014-03-02',
  phone: '0917 111 2222',
  address: 'Naga City',
  province: 'Camarines Sur',
  teamId: 'team-1',
  coachId: null,
  memberYear: 2026,
  ...over,
})

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  app.db.insert(t.staffUsers).values({ id: 's2', name: 'secretariat', username: 'secretariat@sample.example', role: 'secretariat', passwordHash: hashPassword('pw-secretariat'), disabled: false }).run()
  secretariat = await app.signIn.staff('secretariat', 'pw-secretariat')
  app.db.insert(t.teams).values({ id: 'team-1', name: 'Naga Dancers', contactName: '', contactEmail: '', contactPhone: '' }).run()
  athlete = await app.signIn.athleteSignUp('Ana C.', 'ana@test.example', 'a-long-password')
})
afterAll(() => app.close())

describe('athlete records', () => {
  it('adds a record, gives the membership ID of a paid member, and refuses a missing name', async () => {
    const saved = await app.ok<AthleteRecord>('saveAthleteRecord', [input()], secretariat)
    expect(saved).toMatchObject({ name: 'Ana Cruz', memberYear: 2026, teamId: 'team-1' })
    expect(saved.membershipId).toMatch(/^A-\d{5}$/)
    expect((await app.call('saveAthleteRecord', [input({ name: ' ' })], secretariat)).status).toBe(400)
  })

  it('shows an athlete only the names', async () => {
    const [row] = await app.ok<AthleteRecord[]>('getAthleteRecords', [], athlete)
    expect(row).toMatchObject({ name: 'Ana Cruz', phone: '', teamId: null, memberYear: null })
  })

  it('links the account to the record once staff approve, merging the details and removing the record', async () => {
    const [target] = await app.ok<AthleteRecord[]>('getAthleteRecords', [], secretariat)
    await app.ok('claimAthleteRecord', [target!.id], athlete)
    const claims = await app.ok<MemberClaimRow[]>('getMemberClaims', [], secretariat)
    expect(claims).toMatchObject([{ role: 'athlete', name: 'Ana C.', targetName: 'Ana Cruz' }])

    await app.ok('approveMemberClaim', [claims[0]!.memberId], secretariat)
    expect(await app.ok<MemberClaimRow[]>('getMemberClaims', [], secretariat)).toEqual([])
    expect(await app.ok<AthleteRecord[]>('getAthleteRecords', [], secretariat)).toEqual([])
    const page = await app.ok<{ profile: { name: string; birthDate: string; teamId: string; memberYear: number; membershipId: string; claim: unknown } }>('getMyAthlete', [], athlete)
    expect(page.profile).toMatchObject({ name: 'Ana Cruz', birthDate: '2014-03-02', teamId: 'team-1', memberYear: 2026, membershipId: target!.membershipId, claim: null })
  })

  it('lets the athlete take back a request, and staff turn one down', async () => {
    const other = await app.ok<AthleteRecord>('saveAthleteRecord', [input({ name: 'Mia Tan', memberYear: null })], secretariat)
    await app.ok('claimAthleteRecord', [other.id], athlete)
    await app.ok('cancelAthleteClaim', [], athlete)
    expect(await app.ok<MemberClaimRow[]>('getMemberClaims', [], secretariat)).toEqual([])
    await app.ok('claimAthleteRecord', [other.id], athlete)
    const [claim] = await app.ok<MemberClaimRow[]>('getMemberClaims', [], secretariat)
    await app.ok('rejectMemberClaim', [claim!.memberId], secretariat)
    expect(await app.ok<MemberClaimRow[]>('getMemberClaims', [], secretariat)).toEqual([])
    await app.ok('deleteAthleteRecord', [other.id], secretariat)
    expect(await app.ok<AthleteRecord[]>('getAthleteRecords', [], secretariat)).toEqual([])
  })

  it('keeps athletes from adding records', async () => {
    expect((await app.call('saveAthleteRecord', [input()], athlete)).status).toBe(403)
  })
})
