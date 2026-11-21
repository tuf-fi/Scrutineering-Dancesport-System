import type { AdjudicatorState, MarkSubmission, Redance, RoundRow } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { writePaymentSettings } from './paymentSettings.ts'
import { TEST_PHOTO, startTestApp, type TestApp } from './testing.ts'

// A heat danced again: its marks are cleared for those who had submitted, who re-mark only that heat

let app: TestApp
const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
let admin = ''
let secretariat = ''
let scrutineer = ''
let chairperson = ''
let competitionId = ''
let eventId = ''
let semiId = ''
let finalId = ''
let byNumber: string[] = []
const phones: string[] = []
const adjudicatorIds: string[] = []
const dancers = (from: number, to: number) => byNumber.slice(from, to)
// Two dances, so the redo has a count for each
const marks = (samba: string[], rumba: string[]): MarkSubmission[] => [
  { dance: 'samba', competitorIds: samba },
  { dance: 'rumba', competitorIds: rumba },
]

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  const staff = [
    ['staff-admin', 'admin'],
    ['staff-sec', 'secretariat'],
    ['staff-scr', 'scrutineer'],
    ['staff-chair', 'chairperson'],
  ] as const
  for (const [id, role] of staff) {
    app.db.insert(t.staffUsers).values({ id, name: `${role} one`, username: `${role}@sample.example`, role, passwordHash: hashPassword('pw-' + role), disabled: false }).run()
  }
  writePaymentSettings(app.sqlite, { fees: { solo: 500, couple: 800 }, methods: [] })
  admin = await app.signIn.staff('admin', 'pw-admin')
  secretariat = await app.signIn.staff('secretariat', 'pw-secretariat')
  scrutineer = await app.signIn.staff('scrutineer', 'pw-scrutineer')
  chairperson = await app.signIn.staff('chairperson', 'pw-chairperson')

  competitionId = (await app.ok<{ id: string }>('saveCompetition', [{ name: 'Redance Open', date: today, venue: 'Gym', organizer: 'Org', image: 'data:image/png;base64,iVBORw0KGgo=' }], admin)).id
  eventId = (await app.ok<{ id: string }>('saveEvent', [competitionId, { number: 1, ageGroup: 'juvenile_1', class: 'E1', discipline: 'latin', dances: ['samba', 'rumba'], isSolo: true }], admin)).id
  for (const letter of 'ABC') {
    adjudicatorIds.push((await app.ok<{ id: string }>('createAdjudicator', [{ name: `Adjudicator ${letter}`, letter, photo: TEST_PHOTO }], admin)).id)
  }
  await app.ok('generatePins', [competitionId], admin)
  const issued = await app.ok<Array<{ adjudicatorId: string; pin: string }>>('getAdjudicatorPins', [competitionId], admin)
  await app.ok('setPanel', [eventId, adjudicatorIds], admin)
  const team = await app.ok<{ id: string }>('saveTeam', [{ name: 'Test Team', contactName: 'Coach', contactEmail: '', contactPhone: '' }], secretariat)
  const ids: string[] = []
  for (let i = 1; i <= 10; i++) {
    const dancer = await app.ok<{ id: string }>(
      'createCompetitor',
      [{ names: [`Dancer ${i}`], teamId: team.id, details: { province: '', coachId: null, dancers: [{ birthDate: '', address: '', email: '', phone: '' }], beginner: false, memberYear: Number(today.slice(0, 4)) } }],
      secretariat,
    )
    ids.push(dancer.id)
    await app.ok('registerCompetitor', [{ competitorId: dancer.id, eventIds: [eventId], method: 'gcash', reference: 'GC1234' }], secretariat)
  }
  await app.ok('assignBackNumbers', [], secretariat)
  byNumber = (await app.ok<Array<{ competitorId: string; backNumber: number }>>('getEntryRows', [eventId], secretariat)).sort((a, b) => a.backNumber - b.backNumber).map((r) => r.competitorId)
  await app.ok('planRounds', [competitionId], scrutineer)
  const rounds = await app.ok<RoundRow[]>('getCompetitionRounds', [competitionId], scrutineer)
  semiId = rounds.find((r) => r.type === 'semi_final')!.roundId
  finalId = rounds.find((r) => r.type === 'final')!.roundId
  // Two heats of five
  await app.ok('saveHeats', [semiId, byNumber.map((competitorId, i) => ({ competitorId, heat: i < 5 ? 1 : 2 }))], scrutineer)
  await app.ok('startRound', [semiId], scrutineer)
  for (const id of adjudicatorIds) phones.push(await app.signIn.adjudicator(issued.find((p) => p.adjudicatorId === id)!.pin))
})
afterAll(() => app.close())

const heatOf = (heat: number) => (heat === 1 ? dancers(0, 5) : dancers(5, 10))
const stored = (adjudicator: string) => app.sqlite.prepare('select competitor_id as c, dance as d from marks where round_id = ? and adjudicator_id = ?').all(semiId, adjudicator) as Array<{ c: string; d: string }>
const inHeat = (rows: Array<{ c: string }>, heat: number) => rows.filter((r) => heatOf(heat).includes(r.c))

describe('a redance of one heat', () => {
  it('is only called to the floor again when nobody had marked yet', async () => {
    const early = await app.ok<Redance>('startRedance', [semiId, 1, 'Early request'], scrutineer)
    expect(early).toMatchObject({ seq: 1, heat: 1, required: [] })
    expect(early.doneAt).not.toBeNull()
    const announcements = await app.ok<Array<{ id: string; redance?: boolean }>>('getAnnouncements', [], scrutineer)
    expect(announcements.find((x) => x.id === `call:${semiId}:1:redance1`)).toMatchObject({ redance: true })
  })

  // A: samba 4 in heat 1 and 2 in heat 2; rumba 3 and 3. B: samba 3 and 3; rumba 4 and 2.
  const a = () => marks([...dancers(0, 4), ...dancers(5, 7)], [...dancers(0, 3), ...dancers(5, 8)])
  const b = () => marks([...dancers(0, 3), ...dancers(5, 8)], [...dancers(0, 4), ...dancers(5, 7)])

  it('is refused for the wrong role, an empty reason, a missing heat and a round that is not being marked', async () => {
    await app.ok('submitAdjudicatorMarks', [semiId, a()], phones[0])
    await app.ok('submitAdjudicatorMarks', [semiId, b()], phones[1])
    for (const [who, status] of [[secretariat, 403], [chairperson, 403], [admin, 403], [phones[0], 403]] as const) {
      expect((await app.call('startRedance', [semiId, 2, 'Adjudicator B asked'], who)).status).toBe(status)
    }
    expect((await app.call('startRedance', [semiId, 2, ' '], scrutineer)).error).toMatch(/reason/)
    expect((await app.call('startRedance', [semiId, 9, 'Adjudicator B asked'], scrutineer)).error).toMatch(/does not exist/)
    expect((await app.call('startRedance', [finalId, 1, 'Adjudicator B asked'], scrutineer)).error).toMatch(/being marked/)
  })

  it('clears that heat for the adjudicators who had marked it, and keeps the rest', async () => {
    const before = [stored(adjudicatorIds[0]!).length, stored(adjudicatorIds[1]!).length]
    expect(before).toEqual([12, 12])
    const redance = await app.ok<Redance>('startRedance', [semiId, 2, 'Adjudicator B asked'], scrutineer)
    expect(redance).toMatchObject({ seq: 2, heat: 2, doneAt: null, required: expect.arrayContaining([adjudicatorIds[0], adjudicatorIds[1]]) })
    for (const id of adjudicatorIds.slice(0, 2)) {
      expect(inHeat(stored(id), 2)).toHaveLength(0)
      expect(inHeat(stored(id), 1).length).toBeGreaterThan(0)
    }
    expect(stored(adjudicatorIds[0]!)).toHaveLength(7)
    // Their submissions are gone; the third adjudicator had not sent anything and is untouched
    expect(app.sqlite.prepare('select count(*) as n from submissions where round_id = ?').get(semiId)).toEqual({ n: 0 })
    const audit = app.sqlite.prepare("select action, target, before from audit_log where action = 'Started a redance' and target like '%heat 2'").get() as { target: string; before: string }
    expect(audit.target).toMatch(/heat 2/)
    expect(JSON.parse(audit.before).marks).toHaveLength(10)
  })

  it('keeps the recall table and the scores readable while the heat waits, leaving out sheets that are not whole yet', async () => {
    const table = await app.ok<{ submittedCount: number }>('getRecallTable', [semiId], scrutineer)
    expect(table.submittedCount).toBe(0)
    expect((await app.call('getSkatingTable', [semiId], scrutineer)).status).toBe(200)
  })

  it('shows the adjudicator only that heat, with the count they gave it before', async () => {
    const state = await app.ok<AdjudicatorState>('getAdjudicatorState', [], phones[0])
    expect(state).toMatchObject({ status: 'marking', redance: { seq: 2, heat: 2, counts: { samba: 2, rumba: 3 } } })
    if (state.status !== 'marking') throw new Error('expected marking')
    expect([...state.redance!.competitorIds].sort()).toEqual([...heatOf(2)].sort())
    // The adjudicator who had not marked anything sees the normal sheet
    expect(await app.ok<AdjudicatorState>('getAdjudicatorState', [], phones[2])).toMatchObject({ status: 'marking', task: expect.anything() })
    expect((await app.ok<AdjudicatorState>('getAdjudicatorState', [], phones[2]) as { redance?: unknown }).redance).toBeUndefined()
  })

  it('blocks another redance, new heats and an old whole sheet while it waits', async () => {
    expect((await app.call('startRedance', [semiId, 1, 'Again'], scrutineer)).error).toMatch(/waiting/)
    expect((await app.call('saveHeats', [semiId, byNumber.map((competitorId) => ({ competitorId, heat: 1 }))], scrutineer)).error).toMatch(/redance/)
    // A phone sending its old copy of the whole sheet must not undo it
    expect((await app.call('submitAdjudicatorMarks', [semiId, a()], phones[0])).error).toMatch(/redance is waiting/)
  })

  it('takes only the right marks: the heat\'s dancers, the same number per dance', async () => {
    expect((await app.call('submitRedanceMarks', [semiId, marks(dancers(5, 6), dancers(5, 8))], phones[0])).error).toMatch(/exactly 2/)
    expect((await app.call('submitRedanceMarks', [semiId, marks([dancers(0, 1)[0]!, dancers(5, 6)[0]!], dancers(5, 8))], phones[0])).error).toMatch(/only those in heat 2/)
    expect((await app.call('submitRedanceMarks', [semiId, marks(dancers(5, 7), dancers(5, 8)).slice(0, 1)], phones[0])).error).toMatch(/every dance/)
    // The third adjudicator owes nothing
    expect((await app.call('submitRedanceMarks', [semiId, marks(dancers(5, 7), dancers(5, 8))], phones[2])).status).toBe(409)
  })

  it('accepts the re-marks from a phone and from the scrutineer\'s paper, then the round can be reviewed', async () => {
    // The adjudicator may change which of the heat's dancers they pick
    const again = marks([dancers(5, 6)[0]!, dancers(9, 10)[0]!], [dancers(6, 7)[0]!, dancers(7, 8)[0]!, dancers(8, 9)[0]!])
    await app.ok('submitRedanceMarks', [semiId, again], phones[0])
    // A resend of the same marks changes nothing
    await app.ok('submitRedanceMarks', [semiId, again], phones[0])
    expect(inHeat(stored(adjudicatorIds[0]!), 2)).toHaveLength(5)
    expect((await app.ok<Redance[]>('getRedances', [semiId], scrutineer))[1]).toMatchObject({ doneAt: null, redone: [adjudicatorIds[0]] })

    await app.ok('enterRedanceMarks', [adjudicatorIds[1], semiId, marks(dancers(5, 8), dancers(5, 7))], scrutineer)
    const done = (await app.ok<Redance[]>('getRedances', [semiId], scrutineer))[1]!
    expect(done.doneAt).not.toBeNull()
    // The third adjudicator is the only one left, so the round is still being marked
    expect((await app.ok<RoundRow[]>('getCompetitionRounds', [competitionId], scrutineer)).find((r) => r.roundId === semiId)!.status).toBe('marking')

    const sheet = marks([...dancers(0, 3), ...dancers(5, 8)], [...dancers(0, 3), ...dancers(5, 8)])
    await app.ok('submitAdjudicatorMarks', [semiId, sheet], phones[2])
    expect((await app.ok<RoundRow[]>('getCompetitionRounds', [competitionId], scrutineer)).find((r) => r.roundId === semiId)!.status).toBe('review')
    // A finished redance leaves heats open to change again, and a new one can start only while marking
    expect((await app.call('startRedance', [semiId, 1, 'Once more'], scrutineer)).status).toBe(200)
  })
})
