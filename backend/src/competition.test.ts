import type { Announcement, MarkSubmission, RecallTable, RoundRow, SkatingTable } from '@bis/shared'
import { writePaymentSettings } from './paymentSettings.ts'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { startTestApp, type TestApp } from './testing.ts'

// A whole competition through the API, from an empty database: one solo event of ten dancers,
// five adjudicators, a semi-final with a tie at the cutoff, then a final.

let app: TestApp
const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)

let admin: string
let secretariat: string
let scrutineer: string
let chairperson: string
let club: string
let competitionId = ''
let eventId = ''
let adjudicatorIds: string[] = []
let pins: string[] = []
let dancerIds: string[] = []
const phones: string[] = []
let semiId = ''
let finalId = ''
let byNumber: string[] = []
let backupRuns: ReturnType<typeof vi.spyOn>

const solo = { number: 1, ageGroup: 'juvenile', class: 'E1', discipline: 'latin', dances: ['samba'], isSolo: true }

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  const staff = [
    ['staff-admin', 'Admin One', 'admin', 'admin'],
    ['staff-sec', 'Secretariat One', 'secretariat', 'secretariat'],
    ['staff-scr', 'Scrutineer One', 'scrutineer', 'scrutineer'],
    ['staff-chair', 'Chair One', 'chairperson', 'chairperson'],
  ] as const
  for (const [id, name, username, role] of staff) {
    app.db.insert(t.staffUsers).values({ id, name, username, role, passwordHash: hashPassword('pw-' + username), disabled: false }).run()
  }
  writePaymentSettings(app.sqlite, { fees: { solo: 500, couple: 800 }, methods: [] })
  // Every approval should trigger a backup
  backupRuns = vi.spyOn(app.backups, 'run')
  admin = await app.signIn.staff('admin', 'pw-admin')
  secretariat = await app.signIn.staff('secretariat', 'pw-secretariat')
  scrutineer = await app.signIn.staff('scrutineer', 'pw-scrutineer')
  chairperson = await app.signIn.staff('chairperson', 'pw-chairperson')
})
afterAll(() => app.close())

const x = (...competitors: string[]): MarkSubmission[] => [{ dance: 'samba', competitorIds: competitors }]

describe('before the competition', () => {
  it('admin sets up the competition, event, adjudicators and panel', async () => {
    competitionId = (await app.ok<{ id: string }>('saveCompetition', [{ name: 'Test Open', date: today, venue: 'Gym', organizer: 'Org' }], admin)).id
    eventId = (await app.ok<{ id: string }>('saveEvent', [competitionId, solo], admin)).id
    for (const letter of 'ABCDE') {
      adjudicatorIds.push((await app.ok<{ id: string }>('createAdjudicator', [{ name: `Adjudicator ${letter}`, letter }], admin)).id)
    }
    await app.ok('generatePins', [competitionId], admin)
    const issued = await app.ok<Array<{ adjudicatorId: string; pin: string }>>('getAdjudicatorPins', [competitionId], admin)
    // In panel order, so phone i belongs to adjudicator i
    pins = adjudicatorIds.map((id) => issued.find((p) => p.adjudicatorId === id)!.pin)
    expect(new Set(pins).size).toBe(5)
    const panel = await app.ok<{ adjudicatorIds: string[] }>('setPanel', [eventId, adjudicatorIds], admin)
    expect(panel.adjudicatorIds).toHaveLength(5)
  })

  it('a club signs up, registers nine dancers and sends its payment', async () => {
    const signup = await app.app.inject({
      method: 'POST',
      url: '/api/auth/club-signup',
      payload: { name: 'Test Club', contactName: 'Coach', contactEmail: 'coach@test.example', contactPhone: '1', password: 'long-password-1', agreed: true },
    })
    expect(signup.statusCode).toBe(200)
    club = await app.signIn.club('coach@test.example', 'long-password-1')
    for (let i = 1; i <= 10; i++) {
      const dancer = await app.ok<{ id: string }>('saveClubDancer', [{ names: [`Dancer ${i}`], ageGroup: 'juvenile' }], club)
      dancerIds.push(dancer.id)
    }
    // Nine register online; the tenth is a late entry at the venue
    for (const id of dancerIds.slice(0, 9)) {
      const options = await app.ok<Array<{ eventId: string; fee: number }>>('getEntryOptions', [id], club)
      expect(options).toHaveLength(1)
      expect(options[0]).toMatchObject({ eventId, fee: 500 })
      await app.ok('registerClubEntries', [id, [eventId]], club)
    }
    const [payment] = await app.ok<Array<{ amountDue: number; status: string }>>('getClubPayments', [], club)
    expect(payment).toMatchObject({ amountDue: 4500, status: 'unpaid' })

    // Needs a screenshot and a reference number
    expect((await app.call('submitClubPayment', [{ amountPaid: 4500, referenceNumber: '', receiptUrl: 'data:image/png;base64,AAAA' }], club)).status).toBe(400)
    expect((await app.call('submitClubPayment', [{ amountPaid: 4500, referenceNumber: 'GC1', receiptUrl: 'not an image' }], club)).status).toBe(400)
    await app.ok('submitClubPayment', [{ amountPaid: 4500, referenceNumber: 'GC1234', receiptUrl: 'data:image/png;base64,AAAA' }], club)
    // Once sent, the club cannot change its entries
    expect((await app.call('registerClubEntries', [dancerIds[9], [eventId]], club)).status).toBe(409)
  })

  it('admin checks the payment, then the secretariat assigns back numbers and adds the late entry', async () => {
    const details = await app.ok<Array<{ id: string; status: string; clubName: string; lines: unknown[] }>>('getPaymentDetails', [], admin)
    expect(details).toHaveLength(1)
    expect(details[0]).toMatchObject({ status: 'for_checking', clubName: 'Test Club' })
    expect(details[0]!.lines).toHaveLength(9)
    expect((await app.call('rejectPayment', [details[0]!.id, '  '], admin)).status).toBe(400)
    await app.ok('approvePayment', [details[0]!.id], admin)
    // A payment can only be decided once
    expect((await app.call('approvePayment', [details[0]!.id], admin)).status).toBe(409)

    const late = await app.ok<{ entryId: string; fee: number; late: boolean }>('createLateEntry', [{ competitorId: dancerIds[9], eventId, paidInCash: true }], secretariat)
    expect(late).toMatchObject({ fee: 500, late: true })
    expect((await app.call('createLateEntry', [{ competitorId: dancerIds[9], eventId, paidInCash: true }], secretariat)).status).toBe(409)

    expect(await app.ok<number>('assignBackNumbers', [], secretariat)).toBe(10)
    const rows = await app.ok<Array<{ competitorId: string; backNumber: number }>>('getEntryRows', [eventId], secretariat)
    expect(rows.map((r) => r.backNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    byNumber = rows.map((r) => r.competitorId)
  })

  it('the scrutineer plans the rounds: a semi-final and a final', async () => {
    expect(await app.ok<number>('planRounds', [competitionId], scrutineer)).toBe(1)
    // Planning again changes nothing
    expect(await app.ok<number>('planRounds', [competitionId], scrutineer)).toBe(0)
    const rounds = await app.ok<RoundRow[]>('getCompetitionRounds', [competitionId], scrutineer)
    expect(rounds.map((r) => [r.type, r.recallNumber, r.status])).toEqual([
      ['semi_final', 6, 'pending'],
      ['final', null, 'pending'],
    ])
    semiId = rounds[0]!.roundId
    finalId = rounds[1]!.roundId
  })
})

describe('the semi-final', () => {
  it('cannot start the final first, and starting needs a panel and a clear floor', async () => {
    expect((await app.call('startRound', [finalId], scrutineer)).error).toMatch(/previous round/)
    expect((await app.call('startRound', [semiId], secretariat)).status).toBe(403)
  })

  it('goes on the floor and the phones see it', async () => {
    await app.ok('startRound', [semiId], scrutineer)
    expect(app.hub.sent.some((m) => m.event === 'floor' && m.payload === semiId)).toBe(true)
    expect(await app.ok<string>('getCurrentRoundId', [], scrutineer)).toBe(semiId)
    for (const pin of pins) phones.push(await app.signIn.adjudicator(pin))
    const state = await app.ok<{ status: string; task: { competitors: Array<{ id: string; heat: number }>; recallNumber: number } }>('getAdjudicatorState', [], phones[0])
    expect(state.status).toBe('marking')
    expect(state.task.recallNumber).toBe(6)
    expect(state.task.competitors).toHaveLength(10)
    expect(new Set(state.task.competitors.map((c) => c.heat))).toEqual(new Set([1]))
    // Another round cannot be put on the floor over it
    expect((await app.call('startRound', [finalId], scrutineer)).status).toBe(409)
  })

  it('refuses marks that break the rules', async () => {
    const c = byNumber
    expect((await app.call('submitAdjudicatorMarks', [semiId, x(c[0]!, c[1]!)], phones[0])).error).toMatch(/exactly 6/)
    expect((await app.call('submitAdjudicatorMarks', [semiId, x(c[0]!, c[0]!, c[1]!, c[2]!, c[3]!, c[4]!)], phones[0])).error).toMatch(/once/)
    expect((await app.call('submitAdjudicatorMarks', [semiId, x(c[0]!, c[1]!, c[2]!, c[3]!, c[4]!, 'nobody')], phones[0])).error).toMatch(/only those/)
    expect((await app.call('submitAdjudicatorMarks', [semiId, []], phones[0])).error).toMatch(/every dance/)
    // Marks cannot be placed from the wrong account
    expect((await app.call('submitAdjudicatorMarks', [semiId, x(...byNumber.slice(0, 6))], club)).status).toBe(403)
  })

  it('collects every adjudicator\'s marks, storing a resent submission once', async () => {
    const c = byNumber
    // Counts: dancers 1-3 get 5, dancer 4 gets 4, dancers 5-7 get 3 (a tie for the cutoff), 8 and 9 get 1, 10 gets 0
    const sets = [
      [c[0], c[1], c[2], c[3], c[4], c[5]],
      [c[0], c[1], c[2], c[3], c[4], c[6]],
      [c[0], c[1], c[2], c[3], c[5], c[6]],
      [c[0], c[1], c[2], c[3], c[4], c[5]],
      [c[0], c[1], c[2], c[6], c[7], c[8]],
    ] as string[][]
    const first = await Promise.all(sets.slice(0, 3).map((ids, i) => app.call('submitAdjudicatorMarks', [semiId, x(...ids)], phones[i])))
    expect(first.map((r) => r.status)).toEqual([200, 200, 200])

    // The same marks again (a Wi-Fi drop and a resend) change nothing; different marks are refused
    expect((await app.call('submitAdjudicatorMarks', [semiId, x(...sets[0]!)], phones[0])).status).toBe(200)
    expect((await app.call('submitAdjudicatorMarks', [semiId, x(...sets[0]!.slice().reverse())], phones[0])).status).toBe(200)
    expect((await app.call('submitAdjudicatorMarks', [semiId, x(c[9]!, c[8]!, c[7]!, c[6]!, c[5]!, c[4]!)], phones[0])).status).toBe(409)
    expect(app.sqlite.prepare('select count(*) as n from marks where round_id = ?').get(semiId)).toEqual({ n: 18 })

    // The board shows three in, and the round is not ready to approve
    const board = await app.ok<Array<{ status: string }>>('getSubmissions', [semiId], scrutineer)
    expect(board.filter((b) => b.status === 'submitted')).toHaveLength(3)
    expect((await app.call('approveRound', [semiId], scrutineer)).error).toMatch(/Every adjudicator must submit/)

    await Promise.all(sets.slice(3).map((ids, i) => app.ok('submitAdjudicatorMarks', [semiId, x(...ids)], phones[i + 3])))
    const rounds = await app.ok<RoundRow[]>('getCompetitionRounds', [competitionId], scrutineer)
    expect(rounds[0]!.status).toBe('review')
    expect(app.sqlite.prepare('select count(*) as n from marks where round_id = ?').get(semiId)).toEqual({ n: 30 })

    // A phone whose round is in review shows it as submitted
    expect((await app.ok<{ status: string }>('getAdjudicatorState', [], phones[0])).status).toBe('submitted')
  })

  it('finds the tie, needs the chairperson, and recalls the chosen number', async () => {
    const table = await app.ok<RecallTable>('getRecallTable', [semiId], scrutineer)
    expect(table.submittedCount).toBe(5)
    expect(table.tie).toMatchObject({ xCount: 3, count: 3, decision: null })
    expect(table.rows.map((r) => r.xCount)).toEqual([5, 5, 5, 4, 3, 3, 3, 1, 1, 0])
    expect(table.rows.filter((r) => r.outcome === 'tied')).toHaveLength(3)

    expect((await app.call('approveRound', [semiId], scrutineer)).error).toMatch(/Resolve the tie/)
    expect((await app.call('proposeTieDecision', [semiId, 'sideways'], scrutineer)).status).toBe(400)
    expect((await app.call('proposeTieDecision', [semiId, 'fewer'], chairperson)).status).toBe(403)
    await app.ok('proposeTieDecision', [semiId, 'fewer'], scrutineer)
    // Proposed but not confirmed is not enough
    expect((await app.call('approveRound', [semiId], scrutineer)).error).toMatch(/chairperson to confirm/)
    expect((await app.call('confirmTieDecision', [semiId], scrutineer)).status).toBe(403)
    await app.ok('confirmTieDecision', [semiId], chairperson)

    const decided = await app.ok<RecallTable>('getRecallTable', [semiId], scrutineer)
    expect(decided.recalled).toBe(4)
    expect(decided.rows.filter((r) => r.outcome === 'recalled')).toHaveLength(4)
  })

  it('approving recalls four dancers, takes the round off the floor and makes the final\'s field', async () => {
    await app.ok('approveRound', [semiId], scrutineer)
    // Every approval copies the database to the backup folders
    expect(backupRuns).toHaveBeenCalledTimes(1)
    expect(await app.ok<string>('getCurrentRoundId', [], scrutineer)).toBe('')
    const field = await app.ok<Array<{ competitorId: string }>>('getHeatAssignments', [finalId], scrutineer)
    expect(field.map((f) => f.competitorId).sort()).toEqual(byNumber.slice(0, 4).sort())
    // Approved is final: heats and ties cannot change
    expect((await app.call('saveHeats', [semiId, []], scrutineer)).status).toBe(409)
    expect((await app.call('proposeTieDecision', [semiId, 'more'], scrutineer)).status).toBe(409)
    expect((await app.call('approveRound', [semiId], scrutineer)).status).toBe(409)
    // The phones are back to waiting
    expect((await app.ok<{ status: string }>('getAdjudicatorState', [], phones[0])).status).toBe('waiting')
    await app.ok('publishRound', [semiId], scrutineer)
    expect(app.hub.sent.some((m) => m.event === 'published')).toBe(true)
  })
})

describe('the final', () => {
  it('starts with only the recalled dancers', async () => {
    await app.ok('startRound', [finalId], scrutineer)
    const state = await app.ok<{ status: string; task: { competitors: Array<{ id: string; heat: number | null }> } }>('getAdjudicatorState', [], phones[0])
    expect(state.task.competitors).toHaveLength(4)
    expect(state.task.competitors.every((c) => c.heat === null)).toBe(true)
  })

  it('needs every finalist placed once', async () => {
    const c = byNumber
    expect((await app.call('submitAdjudicatorMarks', [finalId, x(c[0]!, c[1]!)], phones[0])).error).toMatch(/every finalist/i)
  })

  it('places the finalists; the scrutineer can type in a phone that failed', async () => {
    const c = byNumber
    const order = [c[0]!, c[1]!, c[2]!, c[3]!]
    const swapped = [c[0]!, c[1]!, c[3]!, c[2]!]
    for (let i = 0; i < 3; i++) await app.ok('submitAdjudicatorMarks', [finalId, x(...order)], phones[i])
    // Adjudicator D's phone died: the scrutineer enters their paper sheet
    expect((await app.call('enterAdjudicatorMarks', [adjudicatorIds[3], finalId, x(...order)], secretariat)).status).toBe(403)
    await app.ok('enterAdjudicatorMarks', [adjudicatorIds[3], finalId, x(...order)], scrutineer)
    const paper = app.sqlite.prepare('select entered_by as by from submissions where round_id = ? and adjudicator_id = ?').get(finalId, adjudicatorIds[3])
    expect(paper).toEqual({ by: 'staff-scr' })
    await app.ok('submitAdjudicatorMarks', [finalId, x(...swapped)], phones[4])

    const table = await app.ok<SkatingTable>('getSkatingTable', [finalId], scrutineer)
    expect(table.complete).toBe(true)
    expect(table.rows.map((r) => r.place)).toEqual([1, 2, 3, 4])
    expect(table.rows.map((r) => r.backNumber)).toEqual([1, 2, 3, 4])
  })

  it('approving stores results and ranking points', async () => {
    await app.ok('approveRound', [finalId], scrutineer)
    expect(backupRuns).toHaveBeenCalledTimes(1)
    const results = await app.ok<Array<{ competitorId: string; place: number; placeFrom: number; placeTo: number }>>('getResults', [eventId], scrutineer)
    const place = Object.fromEntries(results.map((r) => [r.competitorId, [r.place, r.placeFrom, r.placeTo]]))
    expect(place[byNumber[0]!]).toEqual([1, 1, 1])
    expect(place[byNumber[3]!]).toEqual([4, 4, 4])
    // Dancers 5 to 10 were cut in the semi-final and share 5th to 10th
    for (const id of byNumber.slice(4)) expect(place[id]).toEqual([5, 5, 10])

    const points = await app.ok<Array<{ competitorId: string; points: number }>>('getRankingPoints', [{ ageGroup: 'juvenile', class: 'E1', discipline: 'latin' }], scrutineer)
    const earned = Object.fromEntries(points.map((p) => [p.competitorId, p.points]))
    expect([earned[byNumber[0]!], earned[byNumber[1]!], earned[byNumber[2]!], earned[byNumber[3]!]]).toEqual([10, 8, 6, 5])
    expect(byNumber.slice(4).every((id) => earned[id] === 1)).toBe(true)
  })

  it('shows guests nothing until it is published, then the results and an MC list', async () => {
    expect(await app.ok<unknown[]>('getResults', [eventId])).toEqual([])
    expect((await app.call('getSkatingTable', [finalId])).status).toBe(403)
    expect(await app.ok<string[]>('getResultEventIds', [competitionId])).toEqual([])

    await app.ok('publishRound', [finalId], scrutineer)
    const guest = await app.ok<Array<{ place: number }>>('getResults', [eventId])
    expect(guest).toHaveLength(10)
    expect(await app.ok<string[]>('getResultEventIds', [competitionId])).toEqual([eventId])
    expect((await app.call('getSkatingTable', [finalId])).status).toBe(200)
    expect(app.hub.sent.some((m) => m.event === 'rankings')).toBe(true)

    const history = await app.ok<Array<{ place: number; points: number }>>('getCompetitorHistory', [byNumber[0]!])
    expect(history).toEqual([expect.objectContaining({ place: 1, points: 10 })])

    // The MC reads the recall, then the finalists, then results from last place up
    const list = await app.ok<Announcement[]>('getAnnouncements', [], scrutineer)
    expect(list.map((a) => a.kind)).toEqual(['recall', 'finalists', 'result', 'result', 'result', 'result'])
    expect(list.filter((a) => a.kind === 'result').map((a) => a.result!.place)).toEqual([4, 3, 2, 1])
    expect(list[0]!.numbers).toEqual([1, 2, 3, 4])
  })

  it('records who did every step in the audit log', async () => {
    const log = await app.ok<Array<{ actorId: string; action: string }>>('getAuditLog', [], admin)
    const by = (action: string) => log.filter((l) => l.action === action).map((l) => l.actorId)
    expect(by('Started round')).toEqual(['staff-scr', 'staff-scr'])
    expect(by('Approved round')).toEqual(['staff-scr', 'staff-scr'])
    expect(by('Proposed tie decision')).toEqual(['staff-scr'])
    expect(by('Confirmed tie decision')).toEqual(['staff-chair'])
    expect(by('Approved payment')).toEqual(['staff-admin'])
    expect(by('Entered marks from paper')).toEqual(['staff-scr'])
    expect(log.filter((l) => l.action === 'Submitted marks')).toHaveLength(9)
  })
})
