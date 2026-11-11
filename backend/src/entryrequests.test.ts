import type { EntryRequest, MemberClaimRow, MemberRosterRow, RegistrationQuote } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { startTestApp, type TestApp } from './testing.ts'

// A team sends an entry request with a payment screenshot; the secretariat approves it into real entries

let app: TestApp
let secretariat = ''
let admin = ''
let team = ''
let athlete = ''
let competitionId = ''
const events: Record<string, string> = {}

const SHOT = 'data:image/png;base64,iVBORw0KGgo='
const details = { province: 'Camarines Sur', coachId: null, dancers: [{ birthDate: '2090-03-02', address: '', email: '', phone: '' }], beginner: false, memberYear: null }
const event = (number: number, over: Record<string, unknown> = {}) => ({ number, ageGroup: 'juvenile_1', class: 'C', discipline: 'latin', dances: ['samba'], isSolo: true, ...over })

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  for (const [id, username, role] of [['s1', 'admin', 'admin'], ['s2', 'secretariat', 'secretariat']] as const) {
    app.db.insert(t.staffUsers).values({ id, name: username, username: `${username}@sample.example`, role, passwordHash: hashPassword('pw-' + username), disabled: false }).run()
  }
  admin = await app.signIn.staff('admin', 'pw-admin')
  secretariat = await app.signIn.staff('secretariat', 'pw-secretariat')
  app.db.insert(t.teams).values([
    { id: 'team-1', name: 'Naga Dancers', contactName: '', contactEmail: '', contactPhone: '' },
    { id: 'team-2', name: 'Legazpi Stars', contactName: '', contactEmail: '', contactPhone: '' },
  ]).run()
  competitionId = (await app.ok<{ id: string }>('saveCompetition', [{ name: '4th Quarter', date: '2099-12-06', venue: 'Robinsons Naga', organizer: 'BGDT', image: 'data:image/png;base64,iVBORw0KGgo=' }], admin)).id
  const make = async (key: string, input: object) => (events[key] = (await app.ok<{ id: string }>('saveEvent', [competitionId, input], secretariat)).id)
  await make('solo1', event(1))
  await make('solo2', event(2, { dances: ['rumba'] }))
  await make('couple', event(3, { isSolo: false, dances: ['jive'] }))
  await app.ok('createCompetitor', [{ names: ['Ana Cruz'], teamId: 'team-1', details }], secretariat)
  await app.ok('createCompetitor', [{ names: ['Mia Tan'], teamId: 'team-2', details }], secretariat)
  await app.ok('createCompetitor', [{ names: ['Ana Cruz', 'Luis Cruz'], teamId: 'team-1', details: { ...details, dancers: [details.dancers[0], details.dancers[0]] } }], secretariat)

  team = await app.signIn.memberSignUp('team', 'Naga Dancers', 'naga@test.example', 'a-long-password')
  await app.ok('claimRecord', ['team-1'], team)
  const [claim] = await app.ok<MemberClaimRow[]>('getMemberClaims', [], secretariat)
  await app.ok('approveMemberClaim', [claim!.memberId], secretariat)
  athlete = await app.signIn.athleteSignUp('Ana Cruz', 'ana@test.example', 'a-long-password')
})
afterAll(() => app.close())

const entrantsOf = (cookie: string) => app.ok<MemberRosterRow[]>('getMyEntrants', [], cookie)
const request = (competitorId: string, eventIds: string[], over: Record<string, unknown> = {}) => ({ competitorId, eventIds, method: 'gcash', reference: 'GC123', receipt: SHOT, ...over })

describe('entering a competition online', () => {
  it('lets a team enter only its own team\'s dancers, and keeps athletes out', async () => {
    const teamList = await entrantsOf(team)
    expect(teamList.map((r) => r.names.join(' & ')).sort()).toEqual(['Ana Cruz', 'Ana Cruz & Luis Cruz'])
    // An athlete cannot enter or pay for events, only the team can
    expect((await app.call('getMyEntrants', [], athlete)).status).toBe(403)

    const mia = (await app.ok<Array<{ id: string; names: string[] }>>('getCompetitorRows', [], secretariat)).find((c) => c.names[0] === 'Mia Tan')!
    expect((await app.call('quoteMyEntries', [mia.id, [events.solo1]], team)).status).toBe(403)
    expect((await app.call('submitEntryRequest', [request(mia.id, [events.solo1])], athlete)).status).toBe(403)
    expect((await app.call('getMyEntrants', [], secretariat)).status).toBe(403)
  })

  it('shows the fee before sending, and refuses what the entry form would refuse', async () => {
    const [ana] = await entrantsOf(team)
    const quote = await app.ok<RegistrationQuote>('quoteMyEntries', [ana!.competitorId, [events.solo1, events.solo2]], team)
    expect(quote.total).toBeGreaterThan(0)

    const solo = ana!.competitorId
    expect((await app.call('submitEntryRequest', [request(solo, [events.solo1], { method: 'cash' })], team)).error).toMatch(/GCash, Maya or bank/)
    expect((await app.call('submitEntryRequest', [request(solo, [events.solo1], { receipt: '' })], team)).error).toMatch(/screenshot/)
    expect((await app.call('submitEntryRequest', [request(solo, [events.solo1], { receipt: 'not-a-picture' })], team)).error).toMatch(/JPEG, PNG or WebP/)
    expect((await app.call('submitEntryRequest', [request(solo, [events.couple])], team)).error).toMatch(/couple event/)
    expect((await app.call('submitEntryRequest', [request(solo, [])], team)).error).toMatch(/at least one event/)
  })

  it('sends a request, keeps the screenshot away from the list, and blocks a duplicate', async () => {
    const solo = (await entrantsOf(team)).find((r) => r.names.length === 1)!.competitorId
    const before = app.hub.sent.filter((e) => e.event === 'alert').length
    const sent = await app.ok<EntryRequest>('submitEntryRequest', [request(solo, [events.solo1, events.solo2])], team)
    // The secretariat's open screens get a pop-up the moment it arrives
    const alerts = app.hub.sent.filter((e) => e.event === 'alert')
    expect(alerts).toHaveLength(before + 1)
    expect(alerts.at(-1)!.payload).toMatchObject({ roles: ['secretariat', 'admin'], note: { title: 'New entry request', link: '/secretariat/entry-requests' } })
    expect(sent).toMatchObject({ status: 'waiting', eventNumbers: [1, 2], requesterRole: 'team', method: 'gcash' })
    expect(sent.receipt).toBeUndefined()
    expect((await app.ok<EntryRequest[]>('getMyEntryRequests', [], team)).map((r) => r.id)).toEqual([sent.id])
    expect((await app.call('submitEntryRequest', [request(solo, [events.solo2])], team)).error).toMatch(/already waiting/)
    // Only the requester sees it
    expect((await app.call('getMyEntryRequests', [], athlete)).status).toBe(403)
  })

  it('lets the requester take a waiting request back', async () => {
    const solo = (await entrantsOf(team)).find((r) => r.names.length === 1)!.competitorId
    const [waiting] = await app.ok<EntryRequest[]>('getMyEntryRequests', [], team)
    await app.ok('cancelEntryRequest', [waiting!.id], team)
    expect(await app.ok<EntryRequest[]>('getMyEntryRequests', [], team)).toEqual([])
    await app.ok('submitEntryRequest', [request(solo, [events.solo1])], team)
  })

  it('shows the secretariat the request with its screenshot, and approving makes the entries and the payment', async () => {
    const [waiting] = await app.ok<EntryRequest[]>('getEntryRequests', [], secretariat)
    expect(waiting).toMatchObject({ status: 'waiting', receipt: SHOT, requesterName: 'Naga Dancers' })
    expect((await app.call('getEntryRequests', [], team)).status).toBe(403)
    expect((await app.call('approveEntryRequest', [waiting!.id], team)).status).toBe(403)

    await app.ok('approveEntryRequest', [waiting!.id], secretariat)
    const entries = app.db.select().from(t.entries).all().filter((e) => e.competitorId === waiting!.competitorId)
    expect(entries.map((e) => e.eventId)).toEqual([events.solo1])
    const payment = app.db.select().from(t.payments).all().find((p) => p.id === entries[0]!.paymentId)!
    expect(payment).toMatchObject({ teamId: 'team-1', method: 'gcash', referenceNumber: 'GC123', receipt: SHOT, status: 'approved' })
    expect((await app.call('approveEntryRequest', [waiting!.id], secretariat)).status).toBe(409)
    // Already entered, so asking again is refused
    expect((await app.call('submitEntryRequest', [request(waiting!.competitorId, [events.solo1])], team)).error).toMatch(/Already entered/)
  })

  it('tells the team what was decided, and a turned-down request needs a reason', async () => {
    type Note = { kind: string; title: string }
    expect((await app.ok<Note[]>('getMyNotifications', [], team)).map((n) => n.kind)).toContain('entry_approved')

    const mine = (await entrantsOf(team)).find((r) => r.names.length === 2)!
    const sent = await app.ok<EntryRequest>('submitEntryRequest', [request(mine.competitorId, [events.couple])], team)
    expect((await app.call('rejectEntryRequest', [sent.id, '  '], secretariat)).error).toMatch(/Say why/)
    await app.ok('rejectEntryRequest', [sent.id, 'The screenshot is cut off'], secretariat)
    const [back] = (await app.ok<EntryRequest[]>('getMyEntryRequests', [], team)).filter((r) => r.id === sent.id)
    expect(back).toMatchObject({ status: 'rejected', rejectedReason: 'The screenshot is cut off' })
    expect((await app.ok<Note[]>('getMyNotifications', [], team)).map((n) => n.kind)).toContain('entry_rejected')
    // A turned-down request can be sent again
    await app.ok('submitEntryRequest', [request(mine.competitorId, [events.couple])], team)
  })
})

describe('entering a free competition online', () => {
  it('needs no payment method or screenshot, and approving it makes entries with no payment', async () => {
    const free = (await app.ok<{ id: string }>('saveCompetition', [{ name: 'Free Cup', date: '2099-12-20', venue: 'Gym', organizer: 'BGDT', image: SHOT, paymentRequired: false }], admin)).id
    const eventId = (await app.ok<{ id: string }>('saveEvent', [free, event(1)], secretariat)).id
    const ana = (await entrantsOf(team)).find((r) => r.names.length === 1)!
    const sent = await app.ok<EntryRequest>('submitEntryRequest', [{ competitorId: ana.competitorId, eventIds: [eventId], method: 'unpaid', reference: '', receipt: '' }], team)
    expect(sent.total).toBe(0)
    const [waiting] = (await app.ok<EntryRequest[]>('getEntryRequests', [], secretariat)).filter((r) => r.id === sent.id)
    expect(waiting?.status).toBe('waiting')
    await app.ok('approveEntryRequest', [sent.id], secretariat)
    const entry = app.db.select().from(t.entries).all().find((e) => e.eventId === eventId)
    expect(entry?.paymentId).toBeNull()
  })
})
