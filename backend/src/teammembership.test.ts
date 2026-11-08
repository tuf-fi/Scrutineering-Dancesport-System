import type { AthleteRow, MemberClaimRow, TeamMembershipPage } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { startTestApp, type TestApp } from './testing.ts'

// Only a team pays the membership fee, for the athletes it ticks; the secretariat confirms it

let app: TestApp
let secretariat = ''
let team = ''
let coach = ''
let athlete = ''
const SHOT = 'data:image/png;base64,iVBORw0KGgo='

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  app.db.insert(t.staffUsers).values({ id: 's2', name: 'secretariat', username: 'secretariat@sample.example', role: 'secretariat', passwordHash: hashPassword('pw-secretariat'), disabled: false }).run()
  secretariat = await app.signIn.staff('secretariat', 'pw-secretariat')
  app.db.insert(t.teams).values([
    { id: 'team-1', name: 'Naga Dancers', contactName: '', contactEmail: '', contactPhone: '' },
    { id: 'team-2', name: 'Legazpi Stars', contactName: '', contactEmail: '', contactPhone: '' },
  ]).run()
  athlete = await app.signIn.athleteSignUp('Ana Cruz', 'ana@test.example', 'a-long-password')
  await app.ok('saveMyAthlete', [{ name: 'Ana Cruz', birthDate: '2015-01-01', phone: '', address: '', province: '', teamId: 'team-1', coachId: null }], athlete)
  for (const [name, email, teamId] of [['Ben Reyes', 'ben@test.example', 'team-1'], ['Mia Tan', 'mia@test.example', 'team-2']] as const) {
    app.db.insert(t.athletes).values({ id: `a-${name}`, name, email, passwordHash: hashPassword('a-long-password'), teamId }).run()
  }
  team = await app.signIn.memberSignUp('team', 'Naga Dancers', 'naga@test.example', 'a-long-password')
  coach = await app.signIn.memberSignUp('coach', 'Ben Coach', 'coach@test.example', 'a-long-password')
  await app.ok('claimRecord', ['team-1'], team)
  const [claim] = await app.ok<MemberClaimRow[]>('getMemberClaims', [], secretariat)
  await app.ok('approveMemberClaim', [claim!.memberId], secretariat)
})
afterAll(() => app.close())

const ids = async () => Object.fromEntries((await app.ok<TeamMembershipPage>('getTeamMembership', [], team)).athletes.map((a) => [a.name, a.id]))

describe('a team paying the membership fee', () => {
  it('lists only its own athletes, all unpaid', async () => {
    const page = await app.ok<TeamMembershipPage>('getTeamMembership', [], team)
    expect(page.athletes.map((a) => [a.name, a.status])).toEqual([['Ana Cruz', 'unpaid'], ['Ben Reyes', 'unpaid']])
  })

  it('keeps athletes and coaches from paying', async () => {
    expect((await app.call('getTeamMembership', [], athlete)).status).toBe(403)
    expect((await app.call('requestTeamMembership', [{ athleteIds: [], method: 'GCash', receipt: SHOT }], coach)).status).toBe(403)
    expect((await app.call('submitEntryRequest', [{}], athlete)).status).toBe(403)
  })

  it('refuses nobody chosen, a missing screenshot and an athlete of another team', async () => {
    const all = await ids()
    expect((await app.call('requestTeamMembership', [{ athleteIds: [], method: 'GCash', receipt: SHOT }], team)).error).toMatch(/Choose the athletes/)
    expect((await app.call('requestTeamMembership', [{ athleteIds: [all['Ana Cruz']], method: 'GCash', receipt: '' }], team)).error).toMatch(/screenshot/)
    expect((await app.call('requestTeamMembership', [{ athleteIds: [all['Ana Cruz']], method: '', receipt: SHOT }], team)).error).toMatch(/how you paid/)
    expect((await app.call('requestTeamMembership', [{ athleteIds: ['a-Mia Tan'], method: 'GCash', receipt: SHOT }], team)).status).toBe(403)
  })

  it('sends one payment for the ticked athletes only, and the secretariat confirms each', async () => {
    const all = await ids()
    await app.ok('requestTeamMembership', [{ athleteIds: [all['Ana Cruz']], method: 'GCash', receipt: SHOT }], team)
    const page = await app.ok<TeamMembershipPage>('getTeamMembership', [], team)
    expect(page.athletes.map((a) => [a.name, a.status])).toEqual([['Ana Cruz', 'waiting'], ['Ben Reyes', 'unpaid']])
    expect((await app.call('requestTeamMembership', [{ athleteIds: [all['Ana Cruz']], method: 'GCash', receipt: SHOT }], team)).status).toBe(409)

    const rows = await app.ok<AthleteRow[]>('getAthletes', [], secretariat)
    expect(rows.find((r) => r.name === 'Ana Cruz')?.request).toMatchObject({ method: 'GCash', paidBy: 'Naga Dancers' })
    expect(rows.find((r) => r.name === 'Ben Reyes')?.request).toBeNull()
    await app.ok('confirmMembership', [all['Ana Cruz']], secretariat)
    expect((await app.ok<TeamMembershipPage>('getTeamMembership', [], team)).athletes[0]).toMatchObject({ name: 'Ana Cruz', status: 'paid', membershipId: 'A-00001' })
  })
})
