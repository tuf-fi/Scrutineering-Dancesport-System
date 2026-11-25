// What was charged stays charged: agreed request prices, memberships billed once, payments taken back, and lookups
// that must not look like changes
import type { Coach, CompetitorRow, Event, FeeItem, PaymentDetail, RegistrationQuote, RegistrationResult } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import { addSampleAthleteData, addSampleCompetitorData, addSampleEntryData, addSamplePanels, addSampleUpcoming } from './db/seed.ts'
import * as t from './db/schema.ts'
import { endpoint } from './registry.ts'
import { TEST_PHOTO, startTestApp } from './testing.ts'

let app: Awaited<ReturnType<typeof startTestApp>>
let admin = ''
let secretariat = ''
let competitionId = ''
let fee: FeeItem
const events: string[] = []
const YEAR = 2099

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  for (const [id, role] of [['s1', 'admin'], ['s2', 'secretariat']] as const) {
    app.db.insert(t.staffUsers).values({ id, name: role, username: `${role}@sample.example`, role, passwordHash: hashPassword('pw-' + role), disabled: false }).run()
  }
  admin = await app.signIn.staff('admin', 'pw-admin')
  secretariat = await app.signIn.staff('secretariat', 'pw-secretariat')
  app.db.insert(t.teams).values({ id: 'team-1', name: 'Naga Dancers', contactName: '', contactEmail: '', contactPhone: '' }).run()
  app.db.insert(t.memberAccounts).values({ id: 'member-1', role: 'team', name: 'Naga Dancers', email: 'team@t.example', passwordHash: 'x', linkedId: 'team-1' }).run()
  competitionId = (await app.ok<{ id: string }>('saveCompetition', [{ name: 'Open', date: `${YEAR}-12-06`, venue: 'Gym', organizer: 'Org', image: TEST_PHOTO }], admin)).id
  for (const number of [1, 2, 3, 4]) {
    events.push((await app.ok<Event>('saveEvent', [competitionId, { number, ageGroup: 'youth', class: 'E1', discipline: 'latin', dances: ['samba'], isSolo: true }], secretariat)).id)
  }
  fee = await app.ok<FeeItem>('saveCompetitionFee', [competitionId, { name: 'Regular', amount: 300, extra: 100, late: null, eventIds: events }], admin)
})
afterAll(() => app.close())

const price = (amount: number) => app.ok('saveCompetitionFee', [competitionId, { ...fee, amount, eventIds: events }, fee.id], admin)
const dancer = async (name: string, coachId: string | null = null) =>
  (await app.ok<CompetitorRow>('createCompetitor', [{ names: [name], teamId: 'team-1', details: { province: '', coachId, dancers: [], memberYear: null } }], secretariat)).id
const register = (competitorId: string, eventIds: string[], method = 'unpaid', coachFees?: { membership: boolean; summit: boolean }) =>
  app.ok<RegistrationResult>('registerCompetitor', [{ competitorId, eventIds, method, coachFees }], secretariat)
const quote = (competitorId: string, eventIds: string[]) => app.ok<RegistrationQuote>('quoteRegistration', [competitorId, eventIds, { membership: true, summit: true }], secretariat)
const memberYear = async (id: string) => (await app.ok<CompetitorRow[]>('getCompetitorRows', [], secretariat)).find((c) => c.id === id)!.details?.memberYear ?? null
const payment = async (id: string) => (await app.ok<PaymentDetail[]>('getPaymentDetails', [], secretariat)).find((p) => p.id === id)!
const membershipLines = (q: { lines: Array<{ label: string }> }) => q.lines.filter((l) => !/^E\d/.test(l.label)).map((l) => l.label)

describe('lookups', () => {
  it('are not changes, so they never make other screens refetch', () => {
    for (const name of ['quoteRegistration', 'quoteMyEntries', 'findSimilarCompetitors', 'findSimilarAccounts']) expect(endpoint(name)!.write, name).toBe(false)
    expect(endpoint('registerCompetitor')!.write).toBe(true)
  })
})

describe('memberships', () => {
  it('are charged once while the first charge waits to be paid', async () => {
    const coach = await app.ok<Coach>('saveCoach', [{ name: 'Coach Lito', email: '', phone: '', memberYear: null, summitYear: null }], secretariat)
    const ana = await dancer('Ana', coach.id)
    const first = await register(ana, [events[0]!], 'unpaid', { membership: true, summit: true })
    expect(membershipLines(first)).toEqual(['Athlete membership', 'Coach membership', 'Coaches Summit'])
    const next = await quote(ana, [events[1]!])
    expect(membershipLines(next)).toEqual([])
    expect(next.coach).toMatchObject({ membershipDue: false, summitDue: false })

    // The first charge is cancelled with its only entry, so the next one carries them again
    const entry = (await payment(first.paymentId)).lines[0]!.entryId
    await app.ok('deleteEntry', [entry], secretariat)
    expect(membershipLines(await quote(ana, [events[1]!]))).toEqual(['Athlete membership', 'Coach membership', 'Coaches Summit'])
  })

  it('are taken back when the payment is marked unpaid, unless another paid one covers them', async () => {
    const coach = await app.ok<Coach>('saveCoach', [{ name: 'Coach Mia', email: '', phone: '', memberYear: YEAR - 1, summitYear: null }], secretariat)
    const bea = await dancer('Bea', coach.id)
    const made = await register(bea, [events[0]!], 'unpaid', { membership: true, summit: true })
    const coachNow = async () => (await app.ok<Coach[]>('getCoaches', [], secretariat)).find((c) => c.id === coach.id)!
    for (let round = 0; round < 2; round++) {
      await app.ok('markPaidAtVenue', [made.paymentId], secretariat)
      expect(await memberYear(bea)).toBe(YEAR)
      expect(await coachNow()).toMatchObject({ memberYear: YEAR, summitYear: YEAR })
      await app.ok('markUnpaid', [made.paymentId], secretariat)
      expect(await memberYear(bea)).toBeNull()
      expect(await coachNow()).toMatchObject({ memberYear: YEAR - 1, summitYear: null })
    }
    // Still owed on that payment, so it is not charged a second time
    expect(membershipLines(await quote(bea, [events[1]!]))).toEqual([])
  })

  it('are not charged while the team’s own payment for the athlete waits', async () => {
    app.db.insert(t.athletes).values({ id: 'a-cy', name: 'Cy', email: 'cy@t.example', passwordHash: 'x', teamId: 'team-1', request: { year: YEAR, method: 'gcash', receipt: 'x', requestedAt: '2099-01-01', paidBy: 'Naga Dancers' } }).run()
    const cy = (await app.ok<CompetitorRow>('createCompetitor', [{ names: ['Cy'], teamId: 'team-1', details: { province: '', coachId: null, dancers: [{ birthDate: '', address: '', email: 'cy@t.example', phone: '' }], memberYear: null } }], secretariat)).id
    expect(membershipLines(await quote(cy, [events[0]!]))).toEqual([])
    app.sqlite.prepare("UPDATE athletes SET request = json_set(request, '$.rejectedReason', 'blurry') WHERE id = 'a-cy'").run()
    expect(membershipLines(await quote(cy, [events[0]!]))).toEqual(['Athlete membership'])
  })
})

describe('what was charged', () => {
  it('stays on the payment’s lines when the fee changes', async () => {
    await price(300)
    const dee = await dancer('Dee')
    const made = await register(dee, [events[0]!, events[1]!], 'cash')
    await price(999)
    const after = await payment(made.paymentId)
    expect(after.lines.map((l) => l.fee)).toEqual([300, 100])
    expect(after.amountDue).toBe(made.total)
  })

  it('is what an entry request showed, even if the fees change or go before it is approved', async () => {
    await price(300)
    const eve = await dancer('Eve')
    const cookie = await teamCookie()
    const request = await app.ok<{ id: string; total: number }>('submitEntryRequest', [{ competitorId: eve, eventIds: [events[0]!, events[1]!], method: 'gcash', reference: 'REF-EVE', receipt: TEST_PHOTO }], cookie)
    expect(request.total).toBe(900)
    // A second request while the first waits does not bill the membership again
    const other = await app.ok<RegistrationQuote>('quoteMyEntries', [eve, [events[2]!]], cookie)
    expect(membershipLines(other)).toEqual([])
    await price(1500)
    await app.ok('deleteCompetitionFee', [fee.id], admin)
    await app.ok('approveEntryRequest', [request.id], secretariat)
    const made = (await app.ok<PaymentDetail[]>('getPaymentDetails', [], secretariat)).find((p) => p.referenceNumber === 'REF-EVE')!
    expect(made).toMatchObject({ amountDue: 900, amountPaid: 900, status: 'approved' })
    expect(made.lines.map((l) => l.fee)).toEqual([300, 100])
    expect(await memberYear(eve)).toBe(YEAR)
  })
})

describe('sample data on a database that is in use', () => {
  it('never prices an event someone else made', async () => {
    const mine = (await app.ok<Event>('saveEvent', [competitionId, { number: 9, ageGroup: 'youth', class: 'E1', discipline: 'latin', dances: ['rumba'], isSolo: true }], secretariat)).id
    for (const add of [addSampleUpcoming, addSampleAthleteData, addSampleCompetitorData, addSampleEntryData, addSamplePanels]) add(app.db)
    expect(app.sqlite.prepare('SELECT fee_id FROM events WHERE id = ?').get(mine)).toEqual({ fee_id: null })
  })
})

// A real session for the linked team account
async function teamCookie() {
  app.sqlite.prepare('UPDATE member_accounts SET password_hash = ? WHERE id = ?').run(hashPassword('pw-team-account'), 'member-1')
  return app.signIn.member('team', 'team@t.example', 'pw-team-account')
}
