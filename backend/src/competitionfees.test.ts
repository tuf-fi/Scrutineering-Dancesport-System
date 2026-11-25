// Each competition keeps its own fees: the admin adds, edits and removes them and chooses the events each one prices
import type { CompetitorRow, Event, FeeItem, LateEntryRow, RegistrationQuote, RegistrationResult } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { TEST_PHOTO, startTestApp } from './testing.ts'

let app: Awaited<ReturnType<typeof startTestApp>>
let admin = ''
let secretariat = ''
let competitionId = ''
let other = ''
const events: string[] = []

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  for (const [id, role] of [['s1', 'admin'], ['s2', 'secretariat']] as const) {
    app.db.insert(t.staffUsers).values({ id, name: role, username: `${role}@sample.example`, role, passwordHash: hashPassword('pw-' + role), disabled: false }).run()
  }
  admin = await app.signIn.staff('admin', 'pw-admin')
  secretariat = await app.signIn.staff('secretariat', 'pw-secretariat')
  app.db.insert(t.teams).values({ id: 'team-1', name: 'Naga Dancers', contactName: 'Coach', contactEmail: 'c@test.example', contactPhone: '1' }).run()
  const competition = async (name: string) =>
    (await app.ok<{ id: string }>('saveCompetition', [{ name, date: '2026-12-06', venue: 'Gym', organizer: 'Org', image: TEST_PHOTO }], admin)).id
  competitionId = await competition('First')
  other = await competition('Second')
  for (const number of [1, 2, 3]) {
    events.push((await app.ok<Event>('saveEvent', [competitionId, { number, ageGroup: 'youth', class: 'E1', discipline: 'latin', dances: ['samba'], isSolo: true }], secretariat)).id)
  }
})
afterAll(() => app.close())

const dancer = async (name: string) =>
  (await app.ok<CompetitorRow>('createCompetitor', [{ names: [name], teamId: 'team-1' }], secretariat)).id
const quote = (who: string, ids: string[]) => app.call<RegistrationQuote>('quoteRegistration', [who, ids], secretariat)
// Without the memberships, which these tests are not about
const entryLines = (q: RegistrationQuote) => q.lines.filter((l) => l.label.startsWith('E')).map((l) => l.amount)
const fees = () => app.ok<FeeItem[]>('getCompetitionFees', [competitionId], secretariat)

describe('competition fees', () => {
  let regular: FeeItem
  let flat: FeeItem

  it('start empty, and an event without a fee cannot be entered', async () => {
    expect(await fees()).toEqual([])
    const refused = await quote(await dancer('Ana'), [events[0]!])
    expect(refused.status).toBe(409)
    expect(refused.error).toMatch(/No fee is set for E1/)
  })

  it('are added by an admin, with the extra price only where it is set', async () => {
    const input = { name: 'Regular', amount: 300, extra: 100, late: null, eventIds: [events[0]!, events[1]!] }
    expect((await app.call('saveCompetitionFee', [competitionId, input], secretariat)).status).toBe(403)
    regular = await app.ok<FeeItem>('saveCompetitionFee', [competitionId, input], admin)
    flat = await app.ok<FeeItem>('saveCompetitionFee', [competitionId, { name: 'Open', amount: 900, extra: null, late: 1200, eventIds: [events[2]!] }], admin)
    const q = await quote(await dancer('Bea'), events)
    expect(entryLines(q.data)).toEqual([300, 100, 900])
    expect(await app.ok<FeeItem[]>('getCompetitionFees', [other], admin)).toEqual([])
  })

  it('refuse bad prices, a repeated name and another competition’s events', async () => {
    const base = { name: 'Third', amount: 1, extra: null, late: null, eventIds: [] }
    for (const bad of [{ ...base, name: ' ' }, { ...base, amount: -1 }, { ...base, extra: 1.5 }, { ...base, name: 'regular' }]) {
      expect((await app.call('saveCompetitionFee', [competitionId, bad], admin)).error).toBeTruthy()
    }
    expect((await app.call('saveCompetitionFee', [other, { ...base, eventIds: [events[0]!] }], admin)).error).toMatch(/events of this competition/)
    expect(await fees()).toHaveLength(2)
  })

  it('charge a late entry at the late price when set, and the regular price when not', async () => {
    const cara = await dancer('Cara')
    const late = (eventId: string) => app.ok<LateEntryRow>('createLateEntry', [{ competitorId: cara, eventId, paidInCash: true }], secretariat)
    expect((await late(events[2]!)).fee).toBe(1200)
    expect((await late(events[0]!)).fee).toBe(300)
    // Her second entry at a price with an extra rate
    expect((await late(events[1]!)).fee).toBe(100)
  })

  it('keep what was already charged when a price changes', async () => {
    const dee = await dancer('Dee')
    const made = await app.ok<RegistrationResult>('registerCompetitor', [{ competitorId: dee, eventIds: [events[0]!], method: 'unpaid' }], secretariat)
    await app.ok('saveCompetitionFee', [competitionId, { ...regular, amount: 999, eventIds: [events[0]!, events[1]!] }, regular.id], admin)
    const amount = app.sqlite.prepare('SELECT amount_due AS n FROM payments WHERE id = ?').get(made.paymentId) as { n: number }
    expect(amount.n).toBe(made.total)
    expect(entryLines((await quote(await dancer('Eve'), [events[0]!])).data)).toEqual([999])
  })

  it('move events between fees, and leave them unpriced when removed', async () => {
    await app.ok('saveCompetitionFee', [competitionId, { ...flat, eventIds: [events[1]!, events[2]!] }, flat.id], admin)
    const list = await app.ok<Event[]>('getEvents', [competitionId])
    expect(list.map((e) => e.feeId)).toEqual([regular.id, flat.id, flat.id])
    await app.ok('deleteCompetitionFee', [flat.id], admin)
    expect((await app.ok<Event[]>('getEvents', [competitionId])).map((e) => e.feeId)).toEqual([regular.id, null, null])
    expect((await quote(await dancer('Fe'), [events[2]!])).error).toMatch(/No fee is set for E3/)
  })

  it('can be chosen on the event itself, even after it has started', async () => {
    const [first] = await app.ok<Event[]>('getEvents', [competitionId])
    const { id, competitionId: _, ...input } = first!
    expect((await app.call('saveEvent', [competitionId, { ...input, feeId: 'nonsense' }, id], secretariat)).error).toMatch(/fee of this competition/)
    expect((await app.ok<Event>('saveEvent', [competitionId, { ...input, feeId: null }, id], secretariat)).feeId).toBeNull()
  })
})
