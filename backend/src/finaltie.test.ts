import type { FinalTie, MarkSubmission, RoundRow } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from './testing.ts'

// A final where the panel splits evenly between the top two couples: Rules 9 to 11 cannot separate them, so they share
// first place unless the chairperson confirms a tie-break.

const COMP = 'comp-sorsogon-2026'
let app: TestApp
let scrutineer = ''
let chairperson = ''
let round: RoundRow
let top: string[] = []
const phones: string[] = []

const results = () =>
  app.sqlite
    .prepare('SELECT r.place, r.place_from AS pf, r.place_to AS pt, c.back_number AS b FROM results r JOIN competitors c ON c.id = r.competitor_id WHERE r.event_id = ? AND r.stage = \'final\' ORDER BY r.place, c.back_number')
    .all(round.eventId) as Array<{ place: number; pf: number; pt: number; b: number }>

beforeAll(async () => {
  app = await startTestApp()
  scrutineer = await app.signIn.staff('scrutineer')
  chairperson = await app.signIn.staff('chairperson')
  const admin = await app.signIn.staff('admin')
  app.sqlite.exec(`
    DELETE FROM tie_decisions; DELETE FROM marks; DELETE FROM submissions; DELETE FROM heat_competitors; DELETE FROM heats;
    DELETE FROM results; DELETE FROM ranking_points; DELETE FROM rounds; UPDATE competitions SET floor_round_id = NULL;
    UPDATE payments SET status = 'paid_at_venue' WHERE status IN ('unpaid', 'for_checking', 'rejected');
  `)
  await app.ok('generatePins', [COMP], admin)
  await app.ok('planRounds', [COMP], scrutineer)
  const rounds = await app.ok<RoundRow[]>('getCompetitionRounds', [COMP], scrutineer)
  // An event that is a single final
  const counts = new Map<string, number>()
  for (const r of rounds) counts.set(r.eventId, (counts.get(r.eventId) ?? 0) + 1)
  round = rounds.find((r) => r.type === 'final' && counts.get(r.eventId) === 1 && r.dances.length === 1)!
  expect(round, 'a single-dance event that is only a final').toBeDefined()
  // A panel of four, so the vote can split two against two
  const adjudicators = (app.sqlite.prepare('SELECT id FROM adjudicators ORDER BY letter LIMIT 4').all() as Array<{ id: string }>).map((a) => a.id)
  await app.ok('setPanel', [round.eventId, adjudicators], admin)
  for (const id of adjudicators) {
    const pin = (app.sqlite.prepare('SELECT pin FROM adjudicator_pins WHERE competition_id = ? AND adjudicator_id = ?').get(COMP, id) as { pin: string }).pin
    phones.push(await app.signIn.adjudicator(pin))
  }
})
afterAll(() => app.close())

async function markSplit() {
  await app.ok('startRound', [round.roundId], scrutineer)
  for (const [i, phone] of phones.entries()) {
    const state = await app.ok<{ task: { dances: string[]; competitors: Array<{ id: string; backNumber: number | null }> } }>('getAdjudicatorState', [], phone)
    const ordered = [...state.task.competitors].sort((a, b) => (a.backNumber ?? 0) - (b.backNumber ?? 0)).map((c) => c.id)
    top = ordered.slice(0, 2)
    // The last two adjudicators put the top two the other way round
    const placed = i >= 2 ? [ordered[1]!, ordered[0]!, ...ordered.slice(2)] : ordered
    const marks: MarkSubmission[] = state.task.dances.map((dance) => ({ dance: dance as MarkSubmission['dance'], competitorIds: placed }))
    await app.ok('submitAdjudicatorMarks', [round.roundId, marks], phone)
  }
}

describe('a tie in a final', () => {
  it('is shown, and stops the approval until it is decided and confirmed', async () => {
    await markSplit()
    const tie = await app.ok<FinalTie>('getFinalTie', [round.roundId], scrutineer)
    expect(tie.groups).toHaveLength(1)
    expect(tie.groups[0]!.place).toBe(1)
    expect(tie.groups[0]!.competitors.map((c) => c.competitorId).sort()).toEqual([...top].sort())
    expect(tie.decision).toBeNull()

    const blocked = await app.call('approveRound', [round.roundId], scrutineer)
    expect(blocked.status).toBe(409)
    expect(blocked.error).toMatch(/has a tie/)

    // Proposed but not confirmed is still not enough
    await app.ok('proposeFinalTie', [round.roundId, 'order', [top[1], top[0]]], scrutineer)
    expect((await app.call('approveRound', [round.roundId], scrutineer)).status).toBe(409)
  })

  it('needs the right people and a sensible order', async () => {
    expect((await app.call('proposeFinalTie', [round.roundId, 'order', [top[0]]], scrutineer)).status).toBe(400)
    expect((await app.call('proposeFinalTie', [round.roundId, 'order', [top[0], top[0]]], scrutineer)).status).toBe(400)
    expect((await app.call('proposeFinalTie', [round.roundId, 'order', [top[1], top[0]]], chairperson)).status).toBe(403)
    expect((await app.call('confirmFinalTie', [round.roundId], scrutineer)).status).toBe(403)
  })

  it('settles in the order of the tie-break once the chairperson confirms', async () => {
    await app.ok('proposeFinalTie', [round.roundId, 'order', [top[1], top[0]]], scrutineer)
    await app.ok('confirmFinalTie', [round.roundId], chairperson)
    await app.ok('approveRound', [round.roundId], scrutineer)
    const placed = results()
    const winner = app.sqlite.prepare('SELECT back_number AS b FROM competitors WHERE id = ?').get(top[1]) as { b: number }
    expect(placed.filter((r) => r.place === 1)).toEqual([{ place: 1, pf: 1, pt: 1, b: winner.b }])
    expect(placed.filter((r) => r.place === 2)).toHaveLength(1)
    expect(app.sqlite.prepare("SELECT count(*) AS n FROM audit_log WHERE action IN ('Proposed final tie decision', 'Confirmed final tie decision')").get()).toEqual({ n: 3 })
  })

  it('can be kept as a shared place instead', async () => {
    // The same final again, decided the other way
    app.sqlite.exec('DELETE FROM results; DELETE FROM ranking_points; DELETE FROM final_tie_decisions; UPDATE rounds SET status = \'review\'')
    await app.ok('proposeFinalTie', [round.roundId, 'keep'], scrutineer)
    await app.ok('confirmFinalTie', [round.roundId], chairperson)
    await app.ok('approveRound', [round.roundId], scrutineer)
    const placed = results()
    expect(placed.filter((r) => r.place === 1)).toHaveLength(2)
    expect(placed.filter((r) => r.place === 1).every((r) => r.pf === 1 && r.pt === 2)).toBe(true)
  })

  it('is refused if the marks changed after the decision', async () => {
    app.sqlite.exec('DELETE FROM results; DELETE FROM ranking_points; UPDATE rounds SET status = \'review\'')
    app.sqlite.prepare("UPDATE final_tie_decisions SET mode = 'order', \"order\" = ? WHERE round_id = ?").run(JSON.stringify([top[0]]), round.roundId)
    const reply = await app.call('approveRound', [round.roundId], scrutineer)
    expect(reply.status).toBe(409)
    expect(reply.error).toMatch(/marks changed/)
  })
})
