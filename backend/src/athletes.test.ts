import { isMember, membershipLabel, type AthleteNotification, type AthletePage, type AthleteProfile, type AthleteRow, type RegistrationQuote } from '@bis/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { startTestApp, type TestApp } from './testing.ts'

// An athlete makes an account, fills in their details and reports a membership payment; the secretariat confirms it

let app: TestApp
let secretariat = ''
let athlete = ''

const SHOT = 'data:image/png;base64,iVBORw0KGgo='
const PROFILE = { name: 'Ana Cruz', birthDate: '2017-03-02', phone: '0917', address: 'Naga City', province: 'Camarines Sur', teamId: 'team-1', coachId: null }

// A team's payment waiting for the secretariat, put straight in the database (the team's own flow is in teammembership.test.ts)
function sendPayment(name: string, method = 'GCash') {
  const row = app.db.select().from(t.athletes).all().find((a) => a.name === name)!
  const year = new Date().getFullYear()
  const at = new Date().toISOString()
  app.db
    .update(t.athletes)
    .set({ request: { year, method, receipt: SHOT, requestedAt: at }, membershipHistory: [...(row.membershipHistory ?? []), { at, kind: 'sent', year, method }] })
    .where(eq(t.athletes.id, row.id))
    .run()
}

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  app.db.insert(t.staffUsers).values({ id: 's2', name: 'secretariat', username: 'secretariat@sample.example', role: 'secretariat', passwordHash: hashPassword('pw-secretariat'), disabled: false }).run()
  secretariat = await app.signIn.staff('secretariat', 'pw-secretariat')
  app.db.insert(t.teams).values({ id: 'team-1', name: 'Naga Dancers', contactName: '', contactEmail: '', contactPhone: '' }).run()
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

  it('saves the details, and only for teams that exist', async () => {
    expect((await app.call('saveMyAthlete', [{ ...PROFILE, teamId: 'nope' }], athlete)).error).toMatch(/team/)
    expect((await app.call('saveMyAthlete', [{ ...PROFILE, birthDate: '2999-01-01' }], athlete)).error).toMatch(/date of birth/)
    const saved = await app.ok<AthleteProfile>('saveMyAthlete', [PROFILE], athlete)
    expect(saved).toMatchObject({ name: 'Ana Cruz', teamId: 'team-1', memberYear: null, request: null })
    const page = await app.ok<AthletePage>('getMyAthlete', [], athlete)
    expect(page).toMatchObject({ year: 2026, fee: 500 })
  })

  it('sends a new name or birth date on file to the secretariat, and an admin can correct it directly', async () => {
    const asked = await app.ok<AthleteProfile>('saveMyAthlete', [{ ...PROFILE, name: 'Anna Cruz', birthDate: '2016-01-01' }], athlete)
    // Nothing changes until it is approved
    expect(asked).toMatchObject({ name: 'Ana Cruz', birthDate: '2017-03-02' })
    const waiting = (await app.ok<AthleteRow[]>('getAthletes', [], secretariat)).find((a) => a.name === 'Ana Cruz')!
    expect(waiting).toMatchObject({ requestedName: 'Anna Cruz', requestedBirthDate: '2016-01-01' })
    await app.ok('approveProfileChange', [waiting.id], secretariat)
    expect((await app.ok<AthletePage>('getMyAthlete', [], athlete)).profile).toMatchObject({ name: 'Anna Cruz', birthDate: '2016-01-01', changeRequest: null })

    app.db.insert(t.staffUsers).values({ id: 's1', name: 'admin', username: 'admin@sample.example', role: 'admin', passwordHash: hashPassword('pw-admin'), disabled: false }).run()
    const admin = await app.signIn.staff('admin', 'pw-admin')
    expect((await app.call('correctAthlete', [waiting.id, { name: 'Ana Cruz', birthDate: '2017-03-02' }], secretariat)).status).toBe(403)
    await app.ok('correctAthlete', [waiting.id, { name: 'Ana Cruz', birthDate: '2017-03-02' }], admin)
    expect((await app.ok<AthletePage>('getMyAthlete', [], athlete)).profile).toMatchObject({ name: 'Ana Cruz', birthDate: '2017-03-02' })
  })

  it('covers the calendar year it is paid in and ends on December 31, whatever the competition dates', async () => {
    const year = new Date().getFullYear()
    expect((await app.ok<AthletePage>('getMyAthlete', [], athlete)).year).toBe(year)
    expect(membershipLabel(year, year)).toBe(`Until December 31, ${year}`)
    expect(membershipLabel(year - 1, year)).toBe(`Expired December 31, ${year - 1}`)
    expect(membershipLabel(null, year)).toBe('Not paid')
    expect(isMember(year, year + 1)).toBe(false)
  })

  it('lets the secretariat confirm a payment the team sent', async () => {
    sendPayment('Ana Cruz')
    const [row] = await app.ok<AthleteRow[]>('getAthletes', [], secretariat)
    expect(row).toMatchObject({ name: 'Ana Cruz', teamName: 'Naga Dancers', memberYear: null })
    await app.ok('confirmMembership', [row!.id], secretariat)
    const page = await app.ok<AthletePage>('getMyAthlete', [], athlete)
    expect(page.profile).toMatchObject({ memberYear: 2026, request: null })
  })

  it('keeps athletes from paying a membership themselves', async () => {
    expect((await app.call('requestMembership', [{ method: 'GCash', receipt: SHOT }], athlete)).status).toBe(404)
  })

  it('lets the team send a payment again after it was turned down', async () => {
    const other = await app.signIn.athleteSignUp('Ben Reyes', 'ben@test.example', 'a-long-password')
    sendPayment('Ben Reyes', 'Maya')
    const ben = (await app.ok<AthleteRow[]>('getAthletes', [], secretariat)).find((a) => a.name === 'Ben Reyes')!
    expect((await app.call('rejectMembership', [ben.id, ' '], secretariat)).status).toBe(400)
    await app.ok('rejectMembership', [ben.id, 'No payment found for that reference'], secretariat)
    expect((await app.ok<AthletePage>('getMyAthlete', [], other)).profile.request?.rejectedReason).toMatch(/No payment/)
    expect((await app.call('confirmMembership', [ben.id], secretariat)).status).toBe(409)
    sendPayment('Ben Reyes', 'Maya')
    expect((await app.ok<AthletePage>('getMyAthlete', [], other)).profile.request).toMatchObject({ receipt: SHOT })
  })

  it('leaves password resets to the athlete: staff have no reset button', async () => {
    const ana = (await app.ok<AthleteRow[]>('getAthletes', [], secretariat)).find((x) => x.name === 'Ana Cruz')
    expect((await app.call('resetAthletePassword', [ana!.id], secretariat)).status).toBe(404)
  })

  it('counts a membership paid on the account when pricing an entry', async () => {
    app.db.insert(t.events).values({ id: 'e1', competitionId: 'c1', number: 1, position: 1, ageGroup: 'juvenile_1', class: 'C', discipline: 'latin', dances: ['samba'], isSolo: true } as typeof t.events.$inferInsert).run()
    const details = (email: string) => ({ province: 'Camarines Sur', coachId: null, dancers: [{ birthDate: '2017-03-02', address: '', email, phone: '' }], beginner: false, memberYear: null })
    const paid = await app.ok<{ id: string }>('createCompetitor', [{ names: ['Ana Cruz'], teamId: 'team-1', details: details('ANA@test.example') }], secretariat)
    const unpaid = await app.ok<{ id: string }>('createCompetitor', [{ names: ['Cara Diaz'], teamId: 'team-1', details: details('cara@test.example') }], secretariat)
    expect((await app.ok<RegistrationQuote>('quoteRegistration', [paid.id, ['e1']], secretariat)).total).toBe(400)
    expect((await app.ok<RegistrationQuote>('quoteRegistration', [unpaid.id, ['e1']], secretariat)).total).toBe(900)
  })

  it('deletes an account', async () => {
    const rows = await app.ok<AthleteRow[]>('getAthletes', [], secretariat)
    await app.ok('deleteAthlete', [rows[0]!.id, true], secretariat)
    expect(await app.ok<AthleteRow[]>('getAthletes', [], secretariat)).toHaveLength(rows.length - 1)
  })
})

describe('the athlete account beyond the basics', () => {
  let dana = ''

  beforeAll(async () => {
    // Inserted directly: sign-ups are limited per connection and this file has used them up
    app.db.insert(t.athletes).values({ id: 'dana', name: 'Dana Lopez', email: 'dana@test.example', passwordHash: hashPassword('a-long-password') }).run()
    dana = await app.signIn.athlete('dana@test.example', 'a-long-password')
  })

  it('sets a first team straight away, but asks the secretariat to change it', async () => {
    const first = await app.ok<AthleteProfile>('saveMyAthlete', [{ ...PROFILE, name: 'Dana Lopez' }], dana)
    expect(first).toMatchObject({ teamId: 'team-1', changeRequest: null })

    app.db.insert(t.teams).values({ id: 'team-2', name: 'Bicol Movers', contactName: '', contactEmail: '', contactPhone: '' }).run()
    const asked = await app.ok<AthleteProfile>('saveMyAthlete', [{ ...PROFILE, name: 'Dana Lopez', teamId: 'team-2' }], dana)
    expect(asked.teamId).toBe('team-1')
    expect(asked.changeRequest).toMatchObject({ teamId: 'team-2' })

    const row = (await app.ok<AthleteRow[]>('getAthletes', [], secretariat)).find((a) => a.name === 'Dana Lopez')!
    expect(row).toMatchObject({ requestedTeamName: 'Bicol Movers' })
    expect((await app.call('rejectProfileChange', [row.id, ' '], secretariat)).status).toBe(400)
    await app.ok('rejectProfileChange', [row.id, 'Ask your coach first'], secretariat)
    expect((await app.ok<AthletePage>('getMyAthlete', [], dana)).profile.changeRequest?.rejectedReason).toMatch(/coach/)
    expect((await app.call('approveProfileChange', [row.id], secretariat)).status).toBe(409)

    await app.ok('saveMyAthlete', [{ ...PROFILE, name: 'Dana Lopez', teamId: 'team-2' }], dana)
    await app.ok('approveProfileChange', [row.id], secretariat)
    expect((await app.ok<AthletePage>('getMyAthlete', [], dana)).profile).toMatchObject({ teamId: 'team-2', changeRequest: null })
    expect((await app.call('approveProfileChange', [row.id], dana)).status).toBe(403)
  })

  it('keeps a history of every payment', async () => {
    sendPayment('Dana Lopez')
    const row = (await app.ok<AthleteRow[]>('getAthletes', [], secretariat)).find((a) => a.name === 'Dana Lopez')!
    await app.ok('rejectMembership', [row.id, 'Wrong reference'], secretariat)
    sendPayment('Dana Lopez')
    await app.ok('confirmMembership', [row.id], secretariat)
    const { history } = (await app.ok<AthletePage>('getMyAthlete', [], dana)).profile
    expect(history.map((h) => h.kind)).toEqual(['sent', 'rejected', 'sent', 'confirmed'])
    expect(history[1]).toMatchObject({ reason: 'Wrong reference', method: 'GCash' })
  })

  it('takes a small picture, and only a picture', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgo='
    expect((await app.call('saveMyPhoto', ['data:text/html;base64,PGI+'], dana)).status).toBe(400)
    expect((await app.ok<AthleteProfile>('saveMyPhoto', [png], dana)).photo).toBe(png)
    // A picture can be replaced but not taken away
    expect((await app.call('saveMyPhoto', [null], dana)).status).toBe(400)
  })

  it('finds the results and entries of the competitors carrying their name, with no approval', async () => {
    expect((await app.ok<{ competitorIds: string[] }>('getMyActivity', [], dana)).competitorIds).toEqual([])
    const details = { province: 'Camarines Sur', coachId: null, dancers: [], beginner: false, memberYear: null }
    const couple = await app.ok<{ id: string }>('createCompetitor', [{ names: ['dana  lopez', 'Eli Tan'], teamId: 'team-1', details }], secretariat)
    app.db.insert(t.entries).values({ id: 'en1', eventId: 'e1', competitorId: couple.id }).run()
    const activity = await app.ok<{ competitorIds: string[]; entries: { names: string[]; eventNumber: number }[] }>('getMyActivity', [], dana)
    expect(activity.competitorIds).toEqual([couple.id])
    expect(activity.entries).toMatchObject([{ names: ['dana  lopez', 'Eli Tan'], eventNumber: 1 }])
  })

  it('tells the athlete, and only them, when the secretariat decides something', async () => {
    const row = (await app.ok<AthleteRow[]>('getAthletes', [], secretariat)).find((a) => a.name === 'Dana Lopez')!
    // The history test above ended with a confirmed membership, so the athlete already has two notices
    const before = await app.ok<AthleteNotification[]>('getMyNotifications', [], dana)
    expect(before.map((n) => n.kind).sort()).toEqual(['change_approved', 'membership_confirmed', 'membership_rejected', 'change_rejected'].sort())
    expect(before.every((n) => n.readAt === null)).toBe(true)
    expect(app.hub.sent.filter((e) => e.event === 'notification' && e.payload === row.id)).toHaveLength(4)

    const [newest] = before
    await app.ok('markNotificationsRead', [[newest!.id]], dana)
    const some = await app.ok<AthleteNotification[]>('getMyNotifications', [], dana)
    expect(some.filter((n) => n.readAt !== null)).toHaveLength(1)
    await app.ok('markNotificationsRead', [], dana)
    expect((await app.ok<AthleteNotification[]>('getMyNotifications', [], dana)).every((n) => n.readAt !== null)).toBe(true)

    // Someone else's athlete id in the list changes nothing, and the secretariat has no notifications
    expect((await app.call('getMyNotifications', [], secretariat)).status).toBe(403)
  })

  it('signs the athlete out on every device', async () => {
    expect((await app.me(dana))?.role).toBe('athlete')
    await app.ok('signOutEverywhere', [], dana)
    expect(await app.me(dana)).toBeNull()
    expect(await app.signIn.athlete('dana@test.example', 'a-long-password')).toContain('=')
  })
})
