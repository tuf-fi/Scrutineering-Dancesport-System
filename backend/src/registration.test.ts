import type { Coach, CompetitorDetails, RegistrationQuote, RegistrationResult } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { startTestApp, type TestApp } from './testing.ts'

// The secretariat registers a team from the paper entry form: one dancer or couple, several events, one payment

let app: TestApp
let secretariat = ''
let admin = ''
let competitionId = ''
let events: Record<string, string> = {}
let coachId = ''

const details = (over: Partial<CompetitorDetails> = {}): CompetitorDetails => ({
  province: 'Camarines Sur',
  coachId,
  dancers: [{ birthDate: '2017-03-02', address: 'Naga City', email: 'ana@test.example', phone: '0917' }],
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

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  for (const [id, username, role] of [['s1', 'admin', 'admin'], ['s2', 'secretariat', 'secretariat']] as const) {
    app.db.insert(t.staffUsers).values({ id, name: username, username: `${username}@sample.example`, role, passwordHash: hashPassword('pw-' + username), disabled: false }).run()
  }
  admin = await app.signIn.staff('admin', 'pw-admin')
  secretariat = await app.signIn.staff('secretariat', 'pw-secretariat')
  app.db.insert(t.teams).values({ id: 'team-1', name: 'Naga Dancers', contactName: 'Coach', contactEmail: 'c@test.example', contactPhone: '1' }).run()
  competitionId = (await app.ok<{ id: string }>('saveCompetition', [{ name: '4th Quarter', date: '2026-12-06', venue: 'Robinsons Naga', organizer: 'BGDT', image: 'data:image/png;base64,iVBORw0KGgo=' }], admin)).id
  const make = async (key: string, input: object) => (events[key] = (await app.ok<{ id: string }>('saveEvent', [competitionId, input], secretariat)).id)
  await make('juv1', event(1))
  await make('juv2', event(2, { dances: ['rumba'] }))
  await make('junior', event(3, { ageGroup: 'junior_1', dances: ['jive'] }))
  await make('bgb', event(4, { kind: 'bgb', dances: ['cha_cha_cha'] }))
  await make('ranking', event(5, { kind: 'ranking', ageGroup: 'junior_1', dances: ['paso_doble'] }))
  coachId = (await app.ok<Coach>('saveCoach', [{ name: 'Coach Lito', email: '', phone: '0918', memberYear: null, summitYear: null }], secretariat)).id
})
afterAll(() => app.close())

describe('registering a team from the entry form', () => {
  it('keeps coaches, and will not delete one who still has competitors', async () => {
    expect((await app.ok<Coach[]>('getCoaches', [], secretariat)).map((c) => c.name)).toEqual(['Coach Lito'])
    await app.ok('createCompetitor', [{ names: ['Ana Cruz'], teamId: 'team-1', details: details() }], secretariat)
    expect((await app.call('deleteCoach', [coachId], secretariat)).status).toBe(409)
    expect((await app.call('saveCoach', [{ name: ' ', email: '', phone: '', memberYear: null, summitYear: null }], secretariat)).error).toMatch(/name/)
  })

  it('prices the first entry in full, extra entries lower, and a new member\'s membership', async () => {
    const ana = (await app.ok<Array<{ id: string; names: string[] }>>('getCompetitorRows', [], secretariat))[0]!
    const quote = await app.ok<RegistrationQuote>('quoteRegistration', [ana.id, [events.juv1, events.juv2]], secretariat)
    expect(quote.lines.map((l) => l.amount)).toEqual([400, 200, 500])
    expect(quote.total).toBe(1100)
    expect(quote.warnings).toEqual([])

    // A ranking event is one fixed price; an older solo event starts its own tier
    const mixed = await app.ok<RegistrationQuote>('quoteRegistration', [ana.id, [events.ranking, events.junior]], secretariat)
    expect(mixed.lines.map((l) => l.amount)).toEqual([600, 1000, 500])
    expect(mixed.warnings.join(' ')).toMatch(/E3: Junior I is for 2013 to 2014, but this dancer was born in \d{4}/)
  })

  it('refuses an event whose age requirement the birth date does not meet', async () => {
    const ana = (await app.ok<Array<{ id: string }>>('getCompetitorRows', [], secretariat))[0]!
    const refused = await app.call('registerCompetitor', [{ competitorId: ana.id, eventIds: [events.junior], method: 'cash' }], secretariat)
    expect(refused.status).toBe(409)
    expect(refused.error).toMatch(/E3: Junior I is for 2013 to 2014, but this dancer was born in \d{4}/)
  })

  it('enters the events with one payment, and does not charge membership again', async () => {
    const ana = (await app.ok<Array<{ id: string }>>('getCompetitorRows', [], secretariat))[0]!
    const result = await app.ok<RegistrationResult>('registerCompetitor', [{ competitorId: ana.id, eventIds: [events.juv1, events.juv2], method: 'gcash', reference: 'GC123' }], secretariat)
    expect(result.total).toBe(1100)
    expect(app.sqlite.prepare('select status, amount_paid as paid, method, reference_number as ref from payments where id = ?').get(result.paymentId)).toEqual({
      status: 'approved',
      paid: 1100,
      method: 'gcash',
      ref: 'GC123',
    })
    expect(app.sqlite.prepare('select count(*) as n from entries where payment_id = ?').get(result.paymentId)).toEqual({ n: 2 })

    // Membership lasts the year, and the two entries already made mean the next is an additional one
    const next = await app.ok<RegistrationQuote>('quoteRegistration', [ana.id, [events.junior]], secretariat)
    expect(next.lines).toEqual([{ label: 'E3 additional entry', amount: 200 }])
    expect((await app.call('registerCompetitor', [{ competitorId: ana.id, eventIds: [events.juv1], method: 'cash' }], secretariat)).status).toBe(409)
  })

  it('leaves an entry unpaid, and warns about beginners without refusing', async () => {
    const made = await app.ok<{ id: string }>('createCompetitor', [{ names: ['Ben Diaz'], teamId: 'team-1', details: details({ beginner: true, dancers: [{ birthDate: '2017-01-01', address: '', email: '', phone: '' }] }) }], secretariat)
    const result = await app.ok<RegistrationResult>('registerCompetitor', [{ competitorId: made.id, eventIds: [events.juv1], method: 'unpaid' }], secretariat)
    expect(result.warnings.join(' ')).toMatch(/E1: a beginner/)
    expect(app.sqlite.prepare('select status from payments where id = ?').get(result.paymentId)).toEqual({ status: 'unpaid' })
    // A beginners event is the one a beginner may enter
    expect((await app.ok<RegistrationQuote>('quoteRegistration', [made.id, [events.bgb]], secretariat)).warnings).toEqual([])
  })

  it('refuses a bad date of birth and a missing choice', async () => {
    expect((await app.call('createCompetitor', [{ names: ['Cy'], teamId: 'team-1', details: details({ dancers: [{ birthDate: '5 May 2012', address: '', email: '', phone: '' }] }) }], secretariat)).error).toMatch(/year-month-day/)
    const ana = (await app.ok<Array<{ id: string }>>('getCompetitorRows', [], secretariat))[0]!
    expect((await app.call('registerCompetitor', [{ competitorId: ana.id, eventIds: [], method: 'cash' }], secretariat)).error).toMatch(/at least one event/)
    expect((await app.call('registerCompetitor', [{ competitorId: ana.id, eventIds: [events.junior], method: 'barter' }], secretariat)).error).toMatch(/how it was paid/)
  })
})

describe('teams kept by the secretariat', () => {
  const blank = { contactName: '', contactEmail: '', contactPhone: '' }

  it('adds, edits and deletes a team, and refuses a blank or repeated name', async () => {
    const made = await app.ok<{ id: string; name: string }>('saveTeam', [{ name: 'Legazpi Movers', contactName: 'Mai', contactEmail: '', contactPhone: '0917' }], secretariat)
    expect(made.name).toBe('Legazpi Movers')
    expect((await app.call('saveTeam', [{ name: '  ', ...blank }], secretariat)).error).toMatch(/team name/)
    expect((await app.call('saveTeam', [{ name: 'legazpi movers', ...blank }], secretariat)).status).toBe(409)
    const edited = await app.ok<{ name: string; contactName: string }>('saveTeam', [{ name: 'Legazpi Movers', contactName: 'Mai Cruz', contactEmail: '', contactPhone: '0917' }, made.id], secretariat)
    expect(edited.contactName).toBe('Mai Cruz')
    expect((await app.call('saveTeam', [{ name: 'Naga Dancers', ...blank }, made.id], secretariat)).status).toBe(409)
    await app.ok('deleteTeam', [made.id], secretariat)
    expect((await app.call('deleteTeam', [made.id], secretariat)).status).toBe(404)
  })

  it('will not delete a team that still has competitors, and is for staff only', async () => {
    expect((await app.call('deleteTeam', ['team-1'], secretariat)).status).toBe(409)
    expect((await app.call('saveTeam', [{ name: 'Guest Team', ...blank }])).status).toBe(401)
  })
})
