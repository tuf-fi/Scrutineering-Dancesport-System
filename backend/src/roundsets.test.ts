import { DEFAULT_MEMBERSHIP_FEES } from '@bis/shared'
import { priceSampleEvents } from './db/sample-fees.ts'
import type { AdjudicatorState, MarkSubmission, ProgramRow, RoundRow } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { writePaymentSettings } from './paymentSettings.ts'
import { TEST_PHOTO, startTestApp, type TestApp } from './testing.ts'

// A pool of 7 adjudicators where only some mark each round: the round's set

let app: TestApp
const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
let admin = ''
let scrutineer = ''
let secretariat = ''
let chairperson = ''
let competitionId = ''
const events: string[] = []
const adjudicators: string[] = []
const phones: string[] = []
const dancers: string[][] = []

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  for (const [id, role] of [['staff-admin', 'admin'], ['staff-sec', 'secretariat'], ['staff-scr', 'scrutineer'], ['staff-chair', 'chairperson']] as const) {
    app.db.insert(t.staffUsers).values({ id, name: `${role} one`, username: `${role}@sample.example`, role, passwordHash: hashPassword('pw-' + role), disabled: false }).run()
  }
  writePaymentSettings(app.sqlite, { memberships: DEFAULT_MEMBERSHIP_FEES, methods: [] })
  admin = await app.signIn.staff('admin', 'pw-admin')
  secretariat = await app.signIn.staff('secretariat', 'pw-secretariat')
  scrutineer = await app.signIn.staff('scrutineer', 'pw-scrutineer')
  chairperson = await app.signIn.staff('chairperson', 'pw-chairperson')
  competitionId = (await app.ok<{ id: string }>('saveCompetition', [{ name: 'Sets Open', date: today, venue: 'Gym', organizer: 'Org', image: 'data:image/png;base64,iVBORw0KGgo=' }], admin)).id
  for (const letter of 'ABCDEFG') {
    adjudicators.push((await app.ok<{ id: string }>('createAdjudicator', [{ name: `Adjudicator ${letter}`, letter, photo: TEST_PHOTO }], admin)).id)
  }
  await app.ok('generatePins', [competitionId], admin)
  const issued = await app.ok<Array<{ adjudicatorId: string; pin: string }>>('getAdjudicatorPins', [competitionId], admin)
  const team = await app.ok<{ id: string }>('saveTeam', [{ name: 'Test Team', contactName: 'Coach', contactEmail: '', contactPhone: '' }], secretariat)
  for (const number of [1, 2]) {
    const eventId = (await app.ok<{ id: string }>('saveEvent', [competitionId, { number, ageGroup: 'juvenile_1', class: 'E1', discipline: 'latin', dances: ['samba'], isSolo: true }], admin)).id
    priceSampleEvents(app.db)
    events.push(eventId)
    await app.ok('setPanel', [eventId, adjudicators], admin)
    const ids: string[] = []
    for (let i = 1; i <= 6; i++) {
      const dancer = await app.ok<{ id: string }>(
        'createCompetitor',
        [{ names: [`Dancer ${number}-${i}`], teamId: team.id, details: { province: '', coachId: null, dancers: [{ birthDate: '', address: '', email: '', phone: '' }], memberYear: Number(today.slice(0, 4)) } }],
        secretariat,
      )
      await app.ok('registerCompetitor', [{ competitorId: dancer.id, eventIds: [eventId], method: 'gcash', reference: 'GC1234' }], secretariat)
      ids.push(dancer.id)
    }
    dancers.push(ids)
  }
  await app.ok('assignBackNumbers', [], secretariat)
  await app.ok('planRounds', [competitionId], scrutineer)
  await app.ok('generateProgram', [competitionId], secretariat)
  for (const id of adjudicators) phones.push(await app.signIn.adjudicator(issued.find((p) => p.adjudicatorId === id)!.pin))
})
afterAll(() => app.close())

const rows = async () => (await app.ok<{ rows: ProgramRow[] }>('getProgram', [competitionId])).rows.filter((r) => r.kind === 'round')
const letters = async (n: number) => (await rows()).find((r) => r.eventNumber === n)!.adjudicators.join('')
const place = (event: number): MarkSubmission[] => [{ dance: 'samba', competitorIds: dancers[event - 1]! }]

describe('the adjudicators of a round', () => {
  it('are the whole panel until a set is chosen', async () => {
    expect(await letters(1)).toBe('ABCDEFG')
    expect((await rows())[0]).toMatchObject({ customSet: false, sequence: 1 })
  })

  it('are chosen from the event panel, and only for the roles that edit the program', async () => {
    expect((await app.call('setRoundSet', [events[0], 'final', adjudicators.slice(0, 5)], phones[0])).status).toBe(403)
    await app.ok('setRoundSet', [events[0], 'final', adjudicators.slice(0, 5)], chairperson)
    await app.ok('setRoundSet', [events[0], 'final', adjudicators.slice(0, 5)], scrutineer)
    expect(await letters(1)).toBe('ABCDE')
    expect((await rows())[0]).toMatchObject({ customSet: true })
    expect((await app.call('setRoundSet', [events[0], 'final', []], secretariat)).error).toMatch(/at least one/)
    expect((await app.call('setRoundSet', [events[0], 'final', ['nobody']], secretariat)).error).toMatch(/panel/)
    expect(await app.ok<Array<{ eventId: string; adjudicatorIds: string[] }>>('getRoundSets', [competitionId], scrutineer)).toEqual([expect.objectContaining({ eventId: events[0], adjudicatorIds: expect.arrayContaining(adjudicators.slice(0, 5)) })])
    // Everyone on the panel is the same as no set
    await app.ok('setRoundSet', [events[0], 'final', adjudicators], admin)
    expect((await rows())[0]).toMatchObject({ customSet: false })
    await app.ok('setRoundSet', [events[0], 'final', null], admin)
  })

  it('rotate: the window of five moves on one place every round', async () => {
    expect(await app.ok<number>('rotateRoundSets', [competitionId, 5], secretariat)).toBe(2)
    expect(await letters(1)).toBe('ABCDE')
    expect(await letters(2)).toBe('BCDEF')
    expect((await app.call('rotateRoundSets', [competitionId, 0], secretariat)).error).toMatch(/how many/)
    // A set as big as the panel is no set
    await app.ok('rotateRoundSets', [competitionId, 7], secretariat)
    expect((await rows()).every((r) => !r.customSet)).toBe(true)
    await app.ok('rotateRoundSets', [competitionId, 5], secretariat)
  })

  it('are the only ones who can mark the round: the others see nothing and are refused', async () => {
    const roundId = (await app.ok<RoundRow[]>('getCompetitionRounds', [competitionId], scrutineer)).find((r) => r.eventNumber === 1)!.roundId
    await app.ok('startRound', [roundId], scrutineer)
    // F and G sit out
    expect((await app.ok<AdjudicatorState>('getAdjudicatorState', [], phones[5])).status).toBe('waiting')
    expect((await app.call('submitAdjudicatorMarks', [roundId, place(1)], phones[5])).status).toBe(403)
    expect((await app.ok<AdjudicatorState>('getAdjudicatorState', [], phones[0])).status).toBe('marking')
    const board = await app.ok<Array<{ adjudicatorId: string }>>('getSubmissions', [roundId], scrutineer)
    expect(board.map((b) => b.adjudicatorId).sort()).toEqual(adjudicators.slice(0, 5).sort())

    // The round is ready for review when the five have submitted, not the seven
    for (const phone of phones.slice(0, 4)) await app.ok('submitAdjudicatorMarks', [roundId, place(1)], phone)
    expect(app.sqlite.prepare('select status from rounds where id = ?').get(roundId)).toEqual({ status: 'marking' })
    await app.ok('submitAdjudicatorMarks', [roundId, place(1)], phones[4])
    expect(app.sqlite.prepare('select status from rounds where id = ?').get(roundId)).toEqual({ status: 'review' })
    const table = await app.ok<{ adjudicators: Array<{ letter: string }>; complete: boolean }>('getSkatingTable', [roundId], scrutineer)
    expect(table.adjudicators.map((a) => a.letter).join('')).toBe('ABCDE')
    expect(table.complete).toBe(true)
    expect(await app.ok<string[]>('getRoundSet', [roundId], scrutineer)).toHaveLength(5)
  })

  it('cannot change once the round has started', async () => {
    expect((await app.call('setRoundSet', [events[0], 'final', adjudicators.slice(2)], scrutineer)).status).toBe(409)
    // Rotating leaves the started round alone
    const before = await letters(1)
    await app.ok('rotateRoundSets', [competitionId, 3], scrutineer)
    expect(await letters(1)).toBe(before)
    expect((await letters(2)).length).toBe(3)
  })

  it('lose anyone taken off the event panel', async () => {
    await app.ok('setRoundSet', [events[1], 'final', adjudicators.slice(3, 7)], scrutineer)
    expect(await letters(2)).toBe('DEFG')
    await app.ok('setPanel', [events[1], adjudicators.slice(0, 6)], admin)
    expect(await letters(2)).toBe('DEF')
  })
})
