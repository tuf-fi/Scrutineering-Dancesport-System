import { DEFAULT_FEE_SCHEDULE, type Coach, type CompetitorDetails, type CompetitorRow, type ImportResult, type PaymentSettings, type RegistrationQuote, type RegistrationResult } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { startTestApp, type TestApp } from './testing.ts'

// Coach fees, memberships paid later, the fee schedule, deadlines, the beginners rule and the CSV columns

let app: TestApp
let secretariat = ''
let admin = ''
let competitionId = ''
let coachId = ''
const events: Record<string, string> = {}

const details = (over: Partial<CompetitorDetails> = {}): CompetitorDetails => ({
  province: 'Camarines Sur',
  coachId,
  dancers: [{ birthDate: '2017-03-02', address: '', email: '', phone: '' }],
  beginner: false,
  memberYear: null,
  ...over,
})

const event = (number: number, over: Record<string, unknown> = {}) => ({
  number,
  ageGroup: 'juvenile_1',
  class: 'C',
  discipline: 'latin',
  dances: ['samba'],
  isSolo: true,
  ...over,
})

const rows = () => app.ok<CompetitorRow[]>('getCompetitorRows', [], secretariat)

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  for (const [id, username, role] of [['s1', 'admin', 'admin'], ['s2', 'secretariat', 'secretariat']] as const) {
    app.db.insert(t.staffUsers).values({ id, name: username, username: `${username}@sample.example`, role, passwordHash: hashPassword('pw-' + username), disabled: false }).run()
  }
  admin = await app.signIn.staff('admin', 'pw-admin')
  secretariat = await app.signIn.staff('secretariat', 'pw-secretariat')
  app.db.insert(t.clubs).values({ id: 'club-1', name: 'Naga Dancers', contactName: 'Coach', contactEmail: 'c@test.example', contactPhone: '1' }).run()
  competitionId = (await app.ok<{ id: string }>('saveCompetition', [{ name: '4th Quarter', date: '2026-12-06', venue: 'Robinsons Naga', organizer: 'BGDT' }], admin)).id
  const make = async (key: string, input: object) => (events[key] = (await app.ok<{ id: string }>('saveEvent', [competitionId, input], secretariat)).id)
  await make('juv1', event(1))
  await make('juv2', event(2, { dances: ['rumba'] }))
  await make('junior', event(3, { ageGroup: 'junior_1', dances: ['jive'] }))
  await make('bgb', event(4, { kind: 'bgb', dances: ['cha_cha_cha'] }))
  coachId = (await app.ok<Coach>('saveCoach', [{ name: 'Coach Lito', email: '', phone: '0918', memberYear: null, summitYear: null }], secretariat)).id
})
afterAll(() => app.close())

describe('coach fees and memberships paid later', () => {
  it('adds the coach fees when asked, and records every membership once the payment is paid', async () => {
    const made = await app.ok<CompetitorRow>('createCompetitor', [{ names: ['Dan Gil'], clubId: 'club-1', details: details() }], secretariat)
    const asked = await app.ok<RegistrationQuote>('quoteRegistration', [made.id, [events.juv1], { membership: true, summit: true }], secretariat)
    expect(asked.coach).toEqual({ name: 'Coach Lito', membershipDue: true, summitDue: true })
    expect(asked.lines.map((l) => [l.label, l.amount])).toEqual([
      ['E1 entry', 400],
      ['Athlete membership', 500],
      ['Coach membership', 1000],
      ['Coaches Summit', 1000],
    ])
    // Not asked for, so not charged
    expect((await app.ok<RegistrationQuote>('quoteRegistration', [made.id, [events.juv1]], secretariat)).total).toBe(900)

    const unpaid = await app.ok<RegistrationResult>(
      'registerCompetitor',
      [{ competitorId: made.id, eventIds: [events.juv1], method: 'unpaid', coachFees: { membership: true, summit: true } }],
      secretariat,
    )
    expect(unpaid.total).toBe(2900)
    expect((await rows()).find((c) => c.id === made.id)!.details?.memberYear).toBeNull()

    await app.ok('markPaidAtVenue', [unpaid.paymentId], secretariat)
    expect((await rows()).find((c) => c.id === made.id)!.details?.memberYear).toBe(2026)
    expect((await app.ok<Coach[]>('getCoaches', [], secretariat))[0]).toMatchObject({ memberYear: 2026, summitYear: 2026 })
    // The coach has paid, so the next dancer is not offered it
    const next = await app.ok<RegistrationQuote>('quoteRegistration', [made.id, [events.juv2]], secretariat)
    expect(next.coach).toMatchObject({ membershipDue: false, summitDue: false })
  })
})

describe('the fee schedule, deadlines and the beginners rule', () => {
  it('shows the default schedule, then prices from a saved one', async () => {
    const shown = await app.ok<PaymentSettings>('getPaymentSettings', [], admin)
    expect(shown.schedule).toEqual(DEFAULT_FEE_SCHEDULE)
    const edited = { ...DEFAULT_FEE_SCHEDULE, soloJuvenile: { first: 450, additional: 150 } }
    const saved = await app.ok<PaymentSettings>('savePaymentSettings', [{ fees: { solo: 500, couple: 800 }, methods: [], schedule: edited }], admin)
    expect(saved.schedule?.soloJuvenile).toEqual({ first: 450, additional: 150 })
    const bad = { ...DEFAULT_FEE_SCHEDULE, fixed: -5 }
    expect((await app.call('savePaymentSettings', [{ fees: { solo: 500, couple: 800 }, methods: [], schedule: bad }], admin)).error).toMatch(/whole pesos/)

    const dancer = (await app.ok<CompetitorRow>('createCompetitor', [{ names: ['Pat Ong'], clubId: 'club-1', details: details({ memberYear: 2026 }) }], secretariat)).id
    expect((await app.ok<RegistrationQuote>('quoteRegistration', [dancer, [events.juv1, events.juv2]], secretariat)).total).toBe(600)
    await app.ok('savePaymentSettings', [{ fees: { solo: 500, couple: 800 }, methods: [], schedule: DEFAULT_FEE_SCHEDULE }], admin)
  })

  it('warns when entries have closed and when fees are overdue', async () => {
    const some = (await rows())[0]!
    const before = await app.ok<RegistrationQuote>('quoteRegistration', [some.id, [events.junior]], secretariat)
    expect(before.warnings.join(' ')).not.toMatch(/Entries closed|Fees were due/)
    const input = { name: '4th Quarter', date: '2026-12-06', venue: 'Robinsons Naga', organizer: 'BGDT', entryDeadline: '2020-01-01', feeDeadline: '2020-01-02' }
    await app.ok('saveCompetition', [input, competitionId], admin)
    const late = (await app.ok<RegistrationQuote>('quoteRegistration', [some.id, [events.junior]], secretariat)).warnings.join(' ')
    expect(late).toMatch(/Entries closed on 2020-01-01. This is a late entry./)
    expect(late).toMatch(/Fees were due on 2020-01-02/)
    expect((await app.call('saveCompetition', [{ ...input, entryDeadline: 'soon' }, competitionId], admin)).error).toMatch(/year-month-day/)
  })

  it('warns when a beginner placed in the top 3 of the same event at the last tournament', async () => {
    app.db.insert(t.competitions).values({ id: 'earlier', name: '3rd Quarter', date: '2026-09-06', venue: 'v', organizer: 'o' }).run()
    app.db
      .insert(t.events)
      .values({ id: 'earlier-bgb', competitionId: 'earlier', number: 4, position: 1, ageGroup: 'juvenile_1', class: 'C', discipline: 'latin', dances: ['cha_cha_cha'], isSolo: true, kind: 'bgb' })
      .run()
    const ben = await app.ok<CompetitorRow>('createCompetitor', [{ names: ['Ben Diaz'], clubId: 'club-1', details: details({ beginner: true }) }], secretariat)
    app.db.insert(t.results).values({ id: 'r1', eventId: 'earlier-bgb', competitorId: ben.id, place: 2, placeFrom: 2, placeTo: 2, stage: 'final', approvedBy: 's2', approvedAt: '2026-09-06T10:00:00Z' }).run()
    const quote = await app.ok<RegistrationQuote>('quoteRegistration', [ben.id, [events.bgb]], secretariat)
    expect(quote.warnings.join(' ')).toMatch(/E4: placed 2nd in this event at 3rd Quarter/)
    // Placing 4th would not matter
    app.db.update(t.results).set({ place: 4, placeFrom: 4, placeTo: 4 }).run()
    expect((await app.ok<RegistrationQuote>('quoteRegistration', [ben.id, [events.bgb]], secretariat)).warnings.join(' ')).not.toMatch(/placed/)
  })
})

describe('importing the entry form columns', () => {
  it('reads province, coach, beginner and each dancer’s details, and skips a bad row', async () => {
    const csv = [
      'Dancer,Partner,Club,Province,Coach,Beginner,Dancer birth date,Dancer contact no.,Dancer email,Dancer address,Partner birth date',
      'Eli Lopez,Mia Lopez,Naga Dancers,Albay,Coach Lito,yes,2012-05-04,0917,e@x.example,Legazpi,2013-01-09',
      'Zed,,Naga Dancers,Albay,Nobody,,,,,',
      'Old,,Naga Dancers,,,,4 May 2012,,,',
    ].join('\n')
    const result = await app.ok<ImportResult>('importCompetitorsCsv', [csv], secretariat)
    expect(result.created).toBe(1)
    expect(result.skipped.map((s) => s.reason)).toEqual(['Unknown coach "Nobody".', 'Enter each date of birth as year-month-day.'])
    const eli = (await rows()).find((c) => c.names[0] === 'Eli Lopez')!
    expect(eli.details).toMatchObject({ province: 'Albay', beginner: true, memberYear: null })
    expect(eli.details?.dancers.map((d) => d.birthDate)).toEqual(['2012-05-04', '2013-01-09'])
    expect(eli.details?.dancers[0]).toMatchObject({ phone: '0917', email: 'e@x.example', address: 'Legazpi' })
  })
})

describe('closed events', () => {
  it('needs a province, warns, and refuses a team from another province', async () => {
    const closed = event(9, { kind: 'closed', dances: ['samba', 'cha_cha_cha'] })
    expect((await app.call('saveEvent', [competitionId, closed], secretariat)).error).toMatch(/province/)
    const id = (await app.ok<{ id: string; province?: string }>('saveEvent', [competitionId, { ...closed, province: ' Camarines Sur ' }], secretariat))
    expect(id.province).toBe('Camarines Sur')

    const local = await app.ok<CompetitorRow>('createCompetitor', [{ names: ['Eli Ong'], clubId: 'club-1', details: details({ province: 'camarines sur' }) }], secretariat)
    const visitor = await app.ok<CompetitorRow>('createCompetitor', [{ names: ['Fay Uy'], clubId: 'club-1', details: details({ province: 'Albay' }) }], secretariat)
    expect((await app.ok<RegistrationQuote>('quoteRegistration', [local.id, [id.id]], secretariat)).warnings.join(' ')).not.toMatch(/closed to/)
    expect((await app.ok<RegistrationQuote>('quoteRegistration', [visitor.id, [id.id]], secretariat)).warnings.join(' ')).toMatch(/E9 is closed to Camarines Sur.*Albay/)

    const input = (competitorId: string) => ({ competitorId, eventIds: [id.id], method: 'unpaid' })
    expect((await app.call('registerCompetitor', [input(visitor.id)], secretariat)).status).toBe(409)
    await app.ok('registerCompetitor', [input(local.id)], secretariat)
  })
})
