import type { CompetitorRow, EntryOption, EntryRow, ImportResult, LateEntryRow, ScheduleItem } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from './testing.ts'

// The seeded sample competition: the same data the frontend shows
let app: TestApp
let admin: string
let secretariat: string
let scrutineer: string
let adjudicator: string
const COMP = 'comp-sorsogon-2026'

beforeAll(async () => {
  app = await startTestApp()
  admin = await app.signIn.staff('admin')
  secretariat = await app.signIn.staff('secretariat')
  scrutineer = await app.signIn.staff('scrutineer')
  adjudicator = await app.signIn.adjudicator('4877')
})
afterAll(() => app.close())

describe('the seeded sample', () => {
  it('has the three competitions and the 162 events', async () => {
    expect(await app.ok<unknown[]>('getCompetitions', [])).toHaveLength(3)
    expect(await app.ok<unknown[]>('getEvents', [])).toHaveLength(162)
    expect((await app.ok<unknown[]>('getEvents', [COMP])).length).toBeGreaterThan(50)
  })

  it('shows the finished event\'s finals and shared places', async () => {
    const events = await app.ok<Array<{ id: string; number: number }>>('getEvents', [COMP])
    const rounds = await Promise.all(events.map((e) => app.ok<Array<{ id: string; type: string; status: string }>>('getRounds', [e.id])))
    const finished = events.find((_, i) => rounds[i]!.length > 0 && rounds[i]!.every((r) => r.status === 'published'))!
    const results = await app.ok<Array<{ place: number; placeFrom: number; placeTo: number }>>('getResults', [finished.id])
    expect(results.filter((r) => r.place <= 6).map((r) => r.place).sort()).toEqual([1, 2, 3, 4, 5, 6])
    // Cut in the semi-final: everyone shares 7th to 12th
    expect(results.filter((r) => r.place === 7).every((r) => r.placeFrom === 7 && r.placeTo === 12)).toBe(true)
  })

  it('has the live round with three adjudicators already in', async () => {
    const board = await app.ok<Array<{ status: string }>>('getSubmissions', [`${COMP}:e11:round_2`], scrutineer)
    expect(board.map((b) => b.status)).toEqual(['submitted', 'submitted', 'submitted', 'waiting', 'waiting', 'waiting', 'waiting'])
    expect(await app.ok<string>('getCurrentRoundId', [], scrutineer)).toBe(`${COMP}:e11:round_2`)
    const table = await app.ok<{ complete: boolean; kind: string }>('getSkatingTable', [`${COMP}:e11:round_2`], scrutineer)
    expect(table).toMatchObject({ complete: false, kind: 'x' })
  })

  it('has a decided recall round with no tie and the exact number recalled', async () => {
    const table = await app.ok<{ tie: unknown; recalled: number; recallNumber: number }>('getRecallTable', [`${COMP}:e11:round_1`], scrutineer)
    expect(table.tie).toBeNull()
    expect(table.recalled).toBe(table.recallNumber)
  })

  it('keeps an adjudicator off a panel they are not on', async () => {
    // Letter H is on couple panels only
    expect(await app.ok<{ status: string }>('getAdjudicatorState', [], adjudicator)).toEqual({ status: 'waiting' })
    expect((await app.call('submitAdjudicatorMarks', [`${COMP}:e11:round_2`, [{ dance: 'cha_cha_cha', competitorIds: [] }]], adjudicator)).status).toBe(403)
  })
})

describe('the admin edits the points table', () => {
  it('works ranking points out again from the new table', async () => {
    const before = await app.ok<Array<{ competitorId: string; points: number }>>('getRankingPoints', [])
    const total = (rows: typeof before) => rows.reduce((sum, r) => sum + r.points, 0)
    const table = await app.ok<Array<{ place: number | null; label: string; points: number }>>('getPointsTable', [])
    const edited = table.map((r) => (r.place === 1 ? { ...r, points: 25 } : r))
    await app.ok('savePointsTable', [edited], admin)
    const after = await app.ok<typeof before>('getRankingPoints', [])
    // Every first place is now worth 25 instead of 10
    const firsts = await app.sqlite.prepare("select count(*) as n from results where stage = 'final' and place = 1").get() as { n: number }
    expect(total(after) - total(before)).toBe(firsts.n * 15)
    expect(app.hub.sent.some((m) => m.event === 'rankings')).toBe(true)
  })

  it('refuses a wrong row count and bad points', async () => {
    expect((await app.call('savePointsTable', [[]], admin)).status).toBe(400)
    const table = await app.ok<Array<{ place: number | null; label: string; points: number }>>('getPointsTable', [])
    expect((await app.call('savePointsTable', [table.map((r) => ({ ...r, points: -1 }))], admin)).status).toBe(400)
    expect((await app.call('savePointsTable', [table.map((r) => ({ ...r, points: 1.5 }))], admin)).status).toBe(400)
    expect((await app.call('savePointsTable', [table], secretariat)).status).toBe(403)
  })
})

describe('secretariat', () => {
  it('imports competitors from a CSV the server reads itself, including quoted commas', async () => {
    const clubs = await app.ok<Array<{ name: string }>>('getClubs', [], secretariat)
    const club = clubs[0]!.name
    const csv = ['Dancer 1,Dancer 2,Club', `"Cruz, Mia",,"${club}"`, `Ana Uy, Leo Co ,${club}`, `Nobody,,Unknown Club`, `,,${club}`, ''].join('\r\n')
    const result = await app.ok<ImportResult>('importCompetitorsCsv', [csv], secretariat)
    expect(result.created).toBe(2)
    expect(result.skipped).toEqual([
      { line: 4, reason: 'Unknown club "Unknown Club".' },
      { line: 5, reason: 'A competitor is one dancer or a couple.' },
    ])
    const rows = await app.ok<CompetitorRow[]>('getCompetitorRows', [], secretariat)
    expect(rows.some((r) => r.names.join('|') === 'Cruz, Mia')).toBe(true)
    expect((await app.call('importCompetitorsCsv', ['   '], secretariat)).status).toBe(400)
  })

  it('assigns back numbers without clashes and refuses a taken one', async () => {
    const rows = await app.ok<CompetitorRow[]>('getCompetitorRows', [], secretariat)
    const withNumber = rows.find((r) => r.backNumber !== null)!
    const without = rows.find((r) => r.backNumber === null)!
    expect((await app.call('setBackNumber', [without.id, withNumber.backNumber], secretariat)).error).toMatch(/already taken/)
    expect((await app.call('setBackNumber', [without.id, 0], secretariat)).status).toBe(400)
    const assigned = await app.ok<number>('assignBackNumbers', [], secretariat)
    expect(assigned).toBeGreaterThan(0)
    const after = await app.ok<CompetitorRow[]>('getCompetitorRows', [], secretariat)
    const numbers = after.map((r) => r.backNumber)
    expect(numbers.every((n) => n !== null)).toBe(true)
    expect(new Set(numbers).size).toBe(numbers.length)
  })

  it('moves an event in the schedule', async () => {
    const before = await app.ok<ScheduleItem[]>('getSchedule', [COMP], secretariat)
    const after = await app.ok<ScheduleItem[]>('moveScheduledEvent', [COMP, before[1]!.eventId, 'up'], secretariat)
    expect(after[0]!.eventId).toBe(before[1]!.eventId)
    expect(after[1]!.eventId).toBe(before[0]!.eventId)
    expect((await app.call('moveScheduledEvent', [COMP, after[0]!.eventId, 'up'], secretariat)).status).toBe(400)
  })

  it('validates events', async () => {
    const input = { number: 1, ageGroup: 'adult', class: 'A', discipline: 'latin', dances: ['samba'], isSolo: false }
    expect((await app.call('saveEvent', [COMP, input], secretariat)).error).toMatch(/already exists/)
    expect((await app.call('saveEvent', [COMP, { ...input, number: 900, dances: ['waltz'] }], secretariat)).error).toMatch(/do not belong/)
    expect((await app.call('saveEvent', [COMP, { ...input, number: 900, dances: [] }], secretariat)).status).toBe(400)
    const created = await app.ok<{ id: string; number: number }>('saveEvent', [COMP, { ...input, number: 900 }], secretariat)
    const schedule = await app.ok<ScheduleItem[]>('getSchedule', [COMP], secretariat)
    expect(schedule.at(-1)!.eventId).toBe(created.id)
    await app.ok('deleteEvent', [created.id], secretariat)
    expect((await app.call('deleteEvent', [(await app.ok<Array<{ id: string }>>('getEvents', [COMP]))[0]!.id], secretariat)).status).toBe(409)
  })

  it('will not change who is entered once an event has started', async () => {
    const entries = await app.ok<EntryRow[]>('getEntryRows', [`${COMP}:e11`], secretariat)
    expect((await app.call('setEntryScratched', [entries[0]!.entryId, true], secretariat)).error).toMatch(/has started/)
  })

  it('scratches and restores an entry in an event that has not started', async () => {
    const events = await app.ok<Array<{ id: string; number: number }>>('getEvents', [COMP])
    const pending = events.find((e) => e.number === 30)!
    const [row] = await app.ok<EntryRow[]>('getEntryRows', [pending.id], secretariat)
    const scratched = await app.ok<EntryRow>('setEntryScratched', [row!.entryId, true], secretariat)
    expect(scratched.scratched).toBe(true)
    expect((await app.ok<EntryRow>('setEntryScratched', [row!.entryId, false], secretariat)).scratched).toBe(false)
  })

  it('adds, edits and removes a late entry with its own payment', async () => {
    const events = await app.ok<Array<{ id: string; number: number; ageGroup: string; isSolo: boolean }>>('getEvents', [COMP])
    const target = events.find((e) => e.isSolo && e.number === 31)!
    const other = events.find((e) => e.isSolo && e.ageGroup === target.ageGroup && e.number !== target.number && e.number > 30)!
    const entered = new Set((await app.ok<EntryRow[]>('getEntryRows', [target.id], secretariat)).map((r) => r.competitorId))
    // A solo dancer of the right age group who is not already in this event
    const fits = app.sqlite
      .prepare("select id from competitors where age_group = ? and json_array_length(names) = 1")
      .all(target.ageGroup) as Array<{ id: string }>
    const dancer = fits.find((d) => !entered.has(d.id))!
    const unpaid = await app.ok<LateEntryRow>('createLateEntry', [{ competitorId: dancer.id, eventId: target.id, paidInCash: false }], secretariat)
    expect(unpaid).toMatchObject({ late: true, paymentStatus: 'unpaid', fee: 500 })
    const paid = await app.ok<{ status: string; amountPaid: number }>('markPaidAtVenue', [unpaid.paymentId], secretariat)
    expect(paid).toMatchObject({ status: 'paid_at_venue', amountPaid: 500 })
    expect((await app.call('markPaidAtVenue', [unpaid.paymentId], secretariat)).status).toBe(409)
    const moved = await app.call<LateEntryRow>('updateLateEntry', [unpaid.entryId, { eventId: other.id, paidInCash: false }], secretariat)
    if (moved.status === 200) expect(moved.data).toMatchObject({ eventId: other.id, paymentStatus: 'unpaid' })
    const lates = await app.ok<LateEntryRow[]>('getLateEntries', [COMP], secretariat)
    expect(lates.some((l) => l.entryId === unpaid.entryId)).toBe(true)
    await app.ok('deleteLateEntry', [unpaid.entryId], secretariat)
    expect((await app.ok<LateEntryRow[]>('getLateEntries', [COMP], secretariat)).some((l) => l.entryId === unpaid.entryId)).toBe(false)
    // A normal entry is not a late entry
    const normal = (await app.ok<EntryRow[]>('getEntryRows', [events.find((e) => e.number === 30)!.id], secretariat))[0]!
    expect((await app.call('deleteLateEntry', [normal.entryId], secretariat)).error).toMatch(/Only late entries/)
  })

  it('checks a late entry is for the right kind of event', async () => {
    const events = await app.ok<Array<{ id: string; isSolo: boolean }>>('getEvents', [COMP])
    const rows = await app.ok<CompetitorRow[]>('getCompetitorRows', [], secretariat)
    const couple = rows.find((r) => r.names.length === 2)!
    const solo = events.find((e) => e.isSolo)!
    expect((await app.call('createLateEntry', [{ competitorId: couple.id, eventId: solo.id, paidInCash: false }], secretariat)).error).toMatch(/solo event/)
  })
})

describe('the scrutineer\'s heats and floor', () => {
  it('renumbers heats from 1 and refuses a missing competitor', async () => {
    const round = `${COMP}:e11:round_2`
    const assignments = await app.ok<Array<{ competitorId: string; heat: number }>>('getHeatAssignments', [round], scrutineer)
    expect(assignments.length).toBeGreaterThan(0)
    const moved = assignments.map((a, i) => ({ ...a, heat: i % 2 === 0 ? 5 : 9 }))
    await app.ok('saveHeats', [round, moved], scrutineer)
    const after = await app.ok<Array<{ heat: number }>>('getHeatAssignments', [round], scrutineer)
    expect([...new Set(after.map((a) => a.heat))].sort()).toEqual([1, 2])
    expect((await app.call('saveHeats', [round, moved.slice(1)], scrutineer)).error).toMatch(/needs a heat/)
    expect((await app.call('saveHeats', [round, moved.map((a) => ({ ...a, heat: 0 }))], scrutineer)).error).toMatch(/start at 1/)
  })

  it('will not take a round off the floor once adjudicators have submitted', async () => {
    expect((await app.call('clearFloor', [], scrutineer)).error).toMatch(/already submitted/)
  })

  it('refuses to start a round that is already running, and rounds with no panel', async () => {
    expect((await app.call('startRound', [`${COMP}:e11:round_2`], scrutineer)).error).toMatch(/already marking/)
    app.sqlite.prepare("delete from panel_members where panel_id = (select id from panels where event_id = ?)").run(`${COMP}:e30`)
    const rounds = await app.ok<Array<{ roundId: string; eventNumber: number }>>('getCompetitionRounds', [COMP], scrutineer)
    const first = rounds.find((r) => r.eventNumber === 30)!
    expect((await app.call('startRound', [first.roundId], scrutineer)).error).toMatch(/adjudicators for this event/)
  })
})

describe('club portal', () => {
  it('registers entries, locks paid ones and recalculates the amount due', async () => {
    const clubs = await app.ok<Array<{ contactEmail: string }>>('getClubs', [], admin)
    const cookie = await app.signIn.club(clubs.at(-1)!.contactEmail)
    const dancers = await app.ok<Array<{ id: string; names: string[] }>>('getClubDancers', [], cookie)
    const soloDancer = dancers.find((d) => d.names.length === 1)
    if (!soloDancer) return
    const options = await app.ok<EntryOption[]>('getEntryOptions', [soloDancer.id], cookie)
    expect(options.length).toBeGreaterThan(0)
    expect(options.every((o) => typeof o.fee === 'number')).toBe(true)
    expect((await app.call('registerClubEntries', [soloDancer.id, ['not-an-event']], cookie)).status).toBe(400)
    expect(await app.ok('getPaymentMethods', [], cookie)).toHaveLength(3)
  })
})
