import { DEFAULT_MEMBERSHIP_FEES } from '@bis/shared'
import { priceSampleEvents } from './db/sample-fees.ts'
import type { AdjudicatorState, MarkSubmission, Redance, RoundRow } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { writePaymentSettings } from './paymentSettings.ts'
import { TEST_PHOTO, startTestApp, type TestApp } from './testing.ts'

// The final is one heat: when it is danced again, everyone who had placed the finalists places them all again

let app: TestApp
const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
let scrutineer = ''
let finalId = ''
let eventId = ''
let byNumber: string[] = []
const phones: string[] = []
const adjudicatorIds: string[] = []
const order = (ids: string[]): MarkSubmission[] => [
  { dance: 'samba', competitorIds: ids },
  { dance: 'rumba', competitorIds: ids },
]

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  for (const [id, role] of [['staff-admin', 'admin'], ['staff-sec', 'secretariat'], ['staff-scr', 'scrutineer']] as const) {
    app.db.insert(t.staffUsers).values({ id, name: `${role} one`, username: `${role}@sample.example`, role, passwordHash: hashPassword('pw-' + role), disabled: false }).run()
  }
  writePaymentSettings(app.sqlite, { memberships: DEFAULT_MEMBERSHIP_FEES, methods: [] })
  const admin = await app.signIn.staff('admin', 'pw-admin')
  const secretariat = await app.signIn.staff('secretariat', 'pw-secretariat')
  scrutineer = await app.signIn.staff('scrutineer', 'pw-scrutineer')
  const competitionId = (await app.ok<{ id: string }>('saveCompetition', [{ name: 'Final Redance Open', date: today, venue: 'Gym', organizer: 'Org', image: 'data:image/png;base64,iVBORw0KGgo=' }], admin)).id
  eventId = (await app.ok<{ id: string }>('saveEvent', [competitionId, { number: 1, ageGroup: 'juvenile_1', class: 'E1', discipline: 'latin', dances: ['samba', 'rumba'], isSolo: true }], admin)).id
  priceSampleEvents(app.db)
  for (const letter of 'ABC') {
    adjudicatorIds.push((await app.ok<{ id: string }>('createAdjudicator', [{ name: `Adjudicator ${letter}`, letter, photo: TEST_PHOTO }], admin)).id)
  }
  await app.ok('generatePins', [competitionId], admin)
  const issued = await app.ok<Array<{ adjudicatorId: string; pin: string }>>('getAdjudicatorPins', [competitionId], admin)
  await app.ok('setPanel', [eventId, adjudicatorIds], admin)
  const team = await app.ok<{ id: string }>('saveTeam', [{ name: 'Test Team', contactName: 'Coach', contactEmail: '', contactPhone: '' }], secretariat)
  for (let i = 1; i <= 6; i++) {
    const dancer = await app.ok<{ id: string }>(
      'createCompetitor',
      [{ names: [`Dancer ${i}`], teamId: team.id, details: { province: '', coachId: null, dancers: [{ birthDate: '', address: '', email: '', phone: '' }], memberYear: Number(today.slice(0, 4)) } }],
      secretariat,
    )
    await app.ok('registerCompetitor', [{ competitorId: dancer.id, eventIds: [eventId], method: 'gcash', reference: 'GC1234' }], secretariat)
  }
  await app.ok('assignBackNumbers', [], secretariat)
  byNumber = (await app.ok<Array<{ competitorId: string; backNumber: number }>>('getEntryRows', [eventId], secretariat)).sort((a, b) => a.backNumber - b.backNumber).map((r) => r.competitorId)
  await app.ok('planRounds', [competitionId], scrutineer)
  const rounds = await app.ok<RoundRow[]>('getCompetitionRounds', [competitionId], scrutineer)
  expect(rounds.map((r) => r.type)).toEqual(['final'])
  finalId = rounds[0]!.roundId
  await app.ok('startRound', [finalId], scrutineer)
  for (const id of adjudicatorIds) phones.push(await app.signIn.adjudicator(issued.find((p) => p.adjudicatorId === id)!.pin))
})
afterAll(() => app.close())

const placing = (adjudicator: string) =>
  app.sqlite.prepare('select competitor_id as c, dance as d, placing as p from marks where round_id = ? and adjudicator_id = ? order by dance, placing').all(finalId, adjudicator) as Array<{ c: string; d: string; p: number }>

describe('a redance of the final', () => {
  const first = () => byNumber
  const again = () => [...byNumber].reverse()

  it('clears the placings of those who had placed, and has them place every finalist again', async () => {
    await app.ok('submitAdjudicatorMarks', [finalId, order(first())], phones[0])
    await app.ok('submitAdjudicatorMarks', [finalId, order(first())], phones[1])
    expect(placing(adjudicatorIds[0]!)).toHaveLength(12)

    const redance = await app.ok<Redance>('startRedance', [finalId, 1, 'Adjudicators asked for the final again'], scrutineer)
    expect(redance).toMatchObject({ seq: 1, heat: 1, doneAt: null, required: expect.arrayContaining([adjudicatorIds[0], adjudicatorIds[1]]) })
    expect(placing(adjudicatorIds[0]!)).toHaveLength(0)
    expect(app.sqlite.prepare('select status from rounds where id = ?').get(finalId)).toEqual({ status: 'marking' })

    const state = await app.ok<AdjudicatorState>('getAdjudicatorState', [], phones[0])
    expect(state).toMatchObject({ status: 'marking', redance: { heat: 1, counts: { samba: 6, rumba: 6 } } })
    // The old whole sheet is refused, and so is an incomplete placing
    expect((await app.call('submitAdjudicatorMarks', [finalId, order(first())], phones[0])).error).toMatch(/redance is waiting/)
    expect((await app.call('submitRedanceMarks', [finalId, order(again().slice(0, 5))], phones[0])).error).toMatch(/Place every finalist/)

    await app.ok('submitRedanceMarks', [finalId, order(again())], phones[0])
    await app.ok('enterRedanceMarks', [adjudicatorIds[1], finalId, order(again())], scrutineer)
    // The third adjudicator had not placed anything, so they place normally
    expect((await app.ok<Redance[]>('getRedances', [finalId], scrutineer))[0]!.doneAt).not.toBeNull()
    await app.ok('submitAdjudicatorMarks', [finalId, order(again())], phones[2])

    // The new order stands: placings run in the order given, and the round can be reviewed and approved
    expect(placing(adjudicatorIds[0]!).filter((m) => m.d === 'samba').map((m) => [m.p, m.c])).toEqual(again().map((c, i) => [i + 1, c]))
    expect(app.sqlite.prepare('select status from rounds where id = ?').get(finalId)).toEqual({ status: 'review' })
    await app.ok('approveRound', [finalId], scrutineer)
    const results = await app.ok<Array<{ competitorId: string; place: number }>>('getResults', [eventId], scrutineer)
    expect(results.sort((a, b) => a.place - b.place).map((r) => r.competitorId)).toEqual(again())
  })
})
