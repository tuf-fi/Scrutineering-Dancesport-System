import type { MemberAccount, MemberClaimRow, MemberRoster } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { startTestApp, type TestApp } from './testing.ts'

// Coaches and teams each make an account and see only their own page

let app: TestApp
let coach = ''
let team = ''
let secretariat = ''

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  coach = await app.signIn.memberSignUp('coach', 'Ben Reyes', 'Ben@Test.example', 'a-long-password')
  team = await app.signIn.memberSignUp('team', 'Naga Dancers', 'naga@test.example', 'a-long-password')
  app.db.insert(t.staffUsers).values({ id: 's2', name: 'secretariat', username: 'secretariat@sample.example', role: 'secretariat', passwordHash: hashPassword('pw-secretariat'), disabled: false }).run()
  secretariat = await app.signIn.staff('secretariat', 'pw-secretariat')
  app.db.insert(t.teams).values([
    { id: 'team-1', name: 'Naga Dancers', contactName: '', contactEmail: '', contactPhone: '' },
    { id: 'team-2', name: 'Legazpi Stars', contactName: '', contactEmail: '', contactPhone: '' },
  ]).run()
  app.db.insert(t.coaches).values({ id: 'coach-1', name: 'Ben Reyes', email: '', phone: '', memberYear: 2026, summitYear: null }).run()
  app.db.insert(t.competitors).values([
    { id: 'p1', names: ['Ana Cruz', 'Luis Cruz'], teamId: 'team-1', details: { province: 'Camarines Sur', coachId: 'coach-1', dancers: [] } as never },
    { id: 'p2', names: ['Mia Tan'], teamId: 'team-2', details: { province: 'Albay', coachId: 'coach-1', dancers: [] } as never },
    { id: 'p3', names: ['Zed Lim'], teamId: 'team-2', details: { province: 'Albay', coachId: null, dancers: [] } as never },
  ]).run()
})
afterAll(() => app.close())

// Sign-ups are rate limited per address, so extra accounts are put straight in the database
async function extra(role: 'coach' | 'team', name: string) {
  app.db.insert(t.memberAccounts).values({ id: `m-${name}`, role, name, email: `${name}@test.example`, passwordHash: hashPassword('a-long-password') }).run()
  return app.signIn.member(role, `${name}@test.example`, 'a-long-password')
}

describe('coach and team accounts', () => {
  it('signs up as the right role and signs in with the email in any case', async () => {
    expect((await app.me(coach))?.role).toBe('coach')
    expect((await app.me(team))?.role).toBe('team')
    expect(await app.signIn.member('coach', 'ben@test.example', 'a-long-password')).toContain('=')
    await expect(app.signIn.member('coach', 'ben@test.example', 'wrong-password')).rejects.toThrow(/Wrong email or password/)
  })

  it('does not let a coach sign in as a team', async () => {
    await expect(app.signIn.member('team', 'ben@test.example', 'a-long-password')).rejects.toThrow(/Wrong email or password/)
  })

  it('refuses a duplicate email, a bad email and a short password', async () => {
    await expect(app.signIn.memberSignUp('team', 'Other', 'ben@test.example', 'another-password')).rejects.toThrow(/already exists/)
    await expect(app.signIn.memberSignUp('team', 'Other', 'nope', 'another-password')).rejects.toThrow(/valid email/)
    await expect(app.signIn.memberSignUp('team', 'Other', 'o@test.example', 'short')).rejects.toThrow(/at least 8/)
  })

  it('gives each their own page and nothing else', async () => {
    expect(await app.ok<MemberAccount>('getMyMember', [], coach)).toMatchObject({ role: 'coach', name: 'Ben Reyes', email: 'ben@test.example' })
    expect(await app.ok<MemberAccount>('getMyMember', [], team)).toMatchObject({ role: 'team', name: 'Naga Dancers' })
    expect((await app.call('getMyMember', [])).status).toBe(401)
    expect((await app.call('getAthletes', [], coach)).status).toBe(403)
    expect((await app.call('getMyAthlete', [], team)).status).toBe(403)
  })

  it('shows nothing until the secretariat links the account to a record', async () => {
    expect(await app.ok<MemberRoster>('getMyRoster', [], coach)).toEqual({ rows: [], payments: [], membership: null })
    expect((await app.call('claimRecord', ['team-1'], coach)).error).toMatch(/Choose your name/)
    expect((await app.call('claimRecord', ['coach-1'], team)).error).toMatch(/Choose your team/)

    const asked = await app.ok<MemberAccount>('claimRecord', ['coach-1'], coach)
    expect(asked.claim).toMatchObject({ id: 'coach-1', name: 'Ben Reyes' })
    expect(asked.linked).toBeNull()
    expect(await app.ok<MemberRoster>('getMyRoster', [], coach)).toMatchObject({ rows: [] })

    const waiting = await app.ok<MemberClaimRow[]>('getMemberClaims', [], secretariat)
    expect(waiting).toHaveLength(1)
    expect(waiting[0]).toMatchObject({ role: 'coach', targetName: 'Ben Reyes' })
    expect((await app.call('getMemberClaims', [], coach)).status).toBe(403)
    expect((await app.call('approveMemberClaim', [waiting[0]!.memberId], coach)).status).toBe(403)
  })

  it('shows a coach their dancers and membership once linked', async () => {
    const [claim] = await app.ok<MemberClaimRow[]>('getMemberClaims', [], secretariat)
    expect(await app.ok<MemberClaimRow[]>('approveMemberClaim', [claim!.memberId], secretariat)).toEqual([])
    expect((await app.ok<MemberAccount>('getMyMember', [], coach)).linked).toMatchObject({ id: 'coach-1' })
    const roster = await app.ok<MemberRoster>('getMyRoster', [], coach)
    expect(roster.rows.map((r) => r.names[0])).toEqual(['Ana Cruz', 'Mia Tan'])
    expect(roster.membership).toEqual({ memberYear: 2026, summitYear: null })
    expect((await app.call('claimRecord', ['coach-1'], coach)).error).toMatch(/already linked/)
  })

  it('shows a team its team dancers and payments, and keeps one account per record', async () => {
    await app.ok('claimRecord', ['team-2'], team)
    const [claim] = await app.ok<MemberClaimRow[]>('getMemberClaims', [], secretariat)
    expect(claim).toMatchObject({ role: 'team', targetName: 'Legazpi Stars' })
    await app.ok('approveMemberClaim', [claim!.memberId], secretariat)
    const roster = await app.ok<MemberRoster>('getMyRoster', [], team)
    expect(roster.rows.map((r) => r.names[0])).toEqual(['Mia Tan', 'Zed Lim'])
    expect(roster.membership).toBeNull()

    const other = await extra('team', 'second')
    await app.ok('claimRecord', ['team-2'], other)
    const [again] = await app.ok<MemberClaimRow[]>('getMemberClaims', [], secretariat)
    expect((await app.call('approveMemberClaim', [again!.memberId], secretariat)).error).toMatch(/already linked to another/)
    expect(await app.ok<MemberClaimRow[]>('rejectMemberClaim', [again!.memberId], secretariat)).toEqual([])
    expect((await app.ok<MemberAccount>('getMyMember', [], other)).claim).toBeNull()
  })

  it('lets an account take back its own request', async () => {
    const third = await extra('coach', 'third')
    await app.ok('claimRecord', ['coach-1'], third)
    expect((await app.ok<MemberAccount>('cancelClaim', [], third)).claim).toBeNull()
    expect(await app.ok<MemberClaimRow[]>('getMemberClaims', [], secretariat)).toEqual([])
  })

  it('lets an account change its details and its password, and sign out everywhere', async () => {
    const own = await extra('coach', 'fourth')
    expect(await app.ok<MemberAccount>('saveMyMember', [{ name: 'fourth', phone: '0917 111 2222' }], own)).toMatchObject({ name: 'fourth', phone: '0917 111 2222' })
    expect((await app.call('saveMyMember', [{ name: '  ', phone: '' }], own)).error).toMatch(/Enter your name/)

    // A coach's new name goes to the secretariat; nothing changes until it is approved
    const asked = await app.ok<MemberAccount>('saveMyMember', [{ name: 'Fourth Coach', phone: '' }], own)
    expect(asked).toMatchObject({ name: 'fourth', changeRequest: { name: 'Fourth Coach' } })
    expect(await app.ok<Array<{ memberId: string; requestedName: string }>>('getMemberChanges', [], secretariat)).toMatchObject([{ memberId: 'm-fourth', requestedName: 'Fourth Coach' }])
    expect((await app.call('getMemberChanges', [], own)).status).toBe(403)
    expect((await app.call('rejectMemberChange', ['m-fourth', ' '], secretariat)).error).toMatch(/why/)
    await app.ok('rejectMemberChange', ['m-fourth', 'Use the name on your ID'], secretariat)
    expect((await app.ok<MemberAccount>('getMyMember', [], own)).changeRequest).toMatchObject({ rejectedReason: 'Use the name on your ID' })
    expect(await app.ok('getMemberChanges', [], secretariat)).toEqual([])

    await app.ok('saveMyMember', [{ name: 'Fourth Coach', birthDate: '1990-05-01', phone: '' }], own)
    await app.ok('approveMemberChange', ['m-fourth'], secretariat)
    expect(await app.ok<MemberAccount>('getMyMember', [], own)).toMatchObject({ name: 'Fourth Coach', birthDate: '1990-05-01', changeRequest: null })
    // A birth date on file is a request too, and only an admin corrects it directly
    expect((await app.ok<MemberAccount>('saveMyMember', [{ name: 'Fourth Coach', birthDate: '1991-01-01', phone: '' }], own)).changeRequest).toMatchObject({ birthDate: '1991-01-01' })
    expect((await app.call('correctMember', ['m-fourth', { name: 'Fourth Coach', birthDate: '1990-05-01' }], secretariat)).status).toBe(403)
    app.db.insert(t.staffUsers).values({ id: 's1', name: 'admin', username: 'admin@sample.example', role: 'admin', passwordHash: hashPassword('pw-admin'), disabled: false }).run()
    const admin = await app.signIn.staff('admin', 'pw-admin')
    await app.ok('correctMember', ['m-fourth', { name: 'Fourth Coach', birthDate: '1989-01-01' }], admin)
    expect((await app.ok<MemberAccount>('getMyMember', [], own)).birthDate).toBe('1989-01-01')

    expect((await app.call('changeMyPassword', ['wrong-password', 'a-new-password'], own)).error).toMatch(/not right/)
    expect((await app.call('changeMyPassword', ['a-long-password', 'short'], own)).error).toMatch(/at least 8/)
    await app.ok('changeMyPassword', ['a-long-password', 'a-new-password'], own)
    await expect(app.signIn.member('coach', 'fourth@test.example', 'a-long-password')).rejects.toThrow(/Wrong email or password/)
    const again = await app.signIn.member('coach', 'fourth@test.example', 'a-new-password')

    await app.ok('signOutEverywhere', [], again)
    expect((await app.call('getMyMember', [], again)).status).toBe(401)
  })

  it('shows a linked account the activity of its dancers', async () => {
    const activity = await app.ok<{ competitorIds: string[] }>('getMyActivity', [], coach)
    expect(activity.competitorIds.sort()).toEqual(['p1', 'p2'])
    const teamActivity = await app.ok<{ competitorIds: string[] }>('getMyActivity', [], team)
    expect(teamActivity.competitorIds.sort()).toEqual(['p2', 'p3'])
  })

  it('tells an account when the secretariat decides, and lets it mark them read', async () => {
    type Note = { id: string; kind: string; readAt: string | null }
    const notes = await app.ok<Note[]>('getMyNotifications', [], coach)
    expect(notes.map((n) => n.kind)).toEqual(['link_approved'])
    expect(notes[0]!.readAt).toBeNull()
    await app.ok('markNotificationsRead', [], coach)
    expect((await app.ok<Note[]>('getMyNotifications', [], coach))[0]!.readAt).not.toBeNull()

    const other = await app.signIn.member('team', 'second@test.example', 'a-long-password')
    expect((await app.ok<Note[]>('getMyNotifications', [], other)).map((n) => n.kind)).toEqual(['link_rejected'])
    // Each account sees only its own
    expect(await app.ok<Note[]>('getMyNotifications', [], team)).toHaveLength(1)
  })
})
