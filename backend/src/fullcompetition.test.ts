import type { MarkSubmission, RoundRow } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from './testing.ts'

// A whole competition, every event from its first round to its published result, the way the venue would run it. Every
// adjudicator marks the same dancers in back-number order, so the correct answer is known without the scoring engine:
// the finalists are the lowest back numbers, placed in back-number order.

const COMP = 'comp-sorsogon-2026'
let app: TestApp
let scrutineer = ''
const phones = new Map<string, string>()
let rounds: RoundRow[] = []

const num = (sql: string, ...args: unknown[]) => (app.sqlite.prepare(sql).get(...args) as { n: number }).n

beforeAll(async () => {
  app = await startTestApp()
  scrutineer = await app.signIn.staff('scrutineer')
  // Start from a competition nobody has run: the sample comes with some rounds already played
  app.sqlite.exec(`
    DELETE FROM tie_decisions; DELETE FROM marks; DELETE FROM submissions; DELETE FROM heat_competitors; DELETE FROM heats;
    DELETE FROM results; DELETE FROM ranking_points; DELETE FROM rounds; UPDATE competitions SET floor_round_id = NULL;
    UPDATE payments SET status = 'paid_at_venue' WHERE status IN ('unpaid', 'for_checking', 'rejected');
  `)
  const admin = await app.signIn.staff('admin')
  await app.ok('generatePins', [COMP], admin)
  const pins = app.sqlite.prepare('SELECT adjudicator_id AS a, pin FROM adjudicator_pins WHERE competition_id = ?').all(COMP) as Array<{ a: string; pin: string }>
  for (const p of pins) phones.set(p.a, await app.signIn.adjudicator(p.pin))
})
afterAll(() => app.close())

describe('a whole competition', () => {
  it('plans a round for every event that has entries', async () => {
    await app.ok('planRounds', [COMP], scrutineer)
    rounds = await app.ok<RoundRow[]>('getCompetitionRounds', [COMP], scrutineer)
    const withEntries = num('SELECT count(DISTINCT e.event_id) AS n FROM entries e JOIN events ev ON ev.id = e.event_id WHERE ev.competition_id = ? AND e.scratched = 0', COMP)
    expect(new Set(rounds.map((r) => r.eventId)).size).toBe(withEntries)
    expect(rounds.length).toBeGreaterThan(50)
  })

  it('runs every round, in order, to a published result', async () => {
    // A round can start only after the one before it was approved, so go round by round until nothing is left
    for (let pass = 0; pass < 6; pass++) {
      rounds = await app.ok<RoundRow[]>('getCompetitionRounds', [COMP], scrutineer)
      const waiting = rounds.filter((r) => r.status === 'pending')
      if (waiting.length === 0) break
      let moved = 0
      for (const round of waiting) {
        const started = await app.call('startRound', [round.roundId], scrutineer)
        if (started.status !== 200) {
          expect(started.error, `event ${round.eventNumber}`).toMatch(/previous round/)
          continue
        }
        // startRound above already put it on the floor; mark and finish it the same way
        const panel = (app.sqlite.prepare('SELECT m.adjudicator_id AS a FROM panel_members m JOIN panels p ON p.id = m.panel_id WHERE p.event_id = ?').all(round.eventId) as Array<{ a: string }>).map((r) => r.a)
        for (const adjudicator of panel) {
          const phone = phones.get(adjudicator)!
          const state = await app.ok<{ task: { recallNumber: number | null; dances: string[]; competitors: Array<{ id: string; backNumber: number | null }> } }>('getAdjudicatorState', [], phone)
          const ordered = [...state.task.competitors].sort((a, b) => (a.backNumber ?? 0) - (b.backNumber ?? 0)).map((c) => c.id)
          const chosen = state.task.recallNumber === null ? ordered : ordered.slice(0, state.task.recallNumber)
          await app.ok('submitAdjudicatorMarks', [round.roundId, state.task.dances.map((dance) => ({ dance: dance as MarkSubmission['dance'], competitorIds: chosen }))], phone)
        }
        await app.ok('approveRound', [round.roundId], scrutineer)
        await app.ok('publishRound', [round.roundId], scrutineer)
        moved++
      }
      expect(moved, 'every pass must finish some round').toBeGreaterThan(0)
    }
    rounds = await app.ok<RoundRow[]>('getCompetitionRounds', [COMP], scrutineer)
    expect(rounds.filter((r) => r.status === 'pending')).toEqual([])
  }, 120_000)

  it('gives every event a result that matches the marks', async () => {
    const events = app.sqlite.prepare('SELECT DISTINCT event_id AS id FROM rounds').all() as Array<{ id: string }>
    for (const { id } of events) {
      const results = app.sqlite
        .prepare('SELECT r.competitor_id AS c, r.place, c.back_number AS b FROM results r JOIN competitors c ON c.id = r.competitor_id WHERE r.event_id = ? ORDER BY r.place, c.back_number')
        .all(id) as Array<{ c: string; place: number; b: number }>
      expect(results.length, `results for ${id}`).toBeGreaterThan(0)
      expect(new Set(results.map((r) => r.c)).size).toBe(results.length)
      // Places count up from 1 with no gaps, except where a shared place skips the numbers it covers
      expect(results[0]!.place).toBe(1)
      const winners = results.filter((r) => r.place === 1)
      expect(winners).toHaveLength(1)
      // The oracle: with identical marks, the winner is the lowest back number among the dancers placed
      expect(winners[0]!.b).toBe(Math.min(...results.map((r) => r.b)))
      // And the finalists are placed in back-number order
      const placed = results.filter((r) => r.place <= 6)
      expect(placed.map((r) => r.b)).toEqual([...placed.map((r) => r.b)].sort((a, b) => a - b))
    }
  })

  it('awards ranking points, always to the winner, and records every step', async () => {
    // Places that earn nothing are not stored, so there are fewer rows than results
    expect(num('SELECT count(*) AS n FROM ranking_points')).toBeLessThanOrEqual(num('SELECT count(*) AS n FROM results'))
    expect(num('SELECT count(*) AS n FROM results r WHERE r.place = 1 AND NOT EXISTS (SELECT 1 FROM ranking_points p WHERE p.event_id = r.event_id AND p.competitor_id = r.competitor_id)')).toBe(0)
    expect(num("SELECT count(*) AS n FROM audit_log WHERE action = 'Approved round'")).toBe(rounds.length)
    // The sample's own history has one earlier entry
    expect(num("SELECT count(*) AS n FROM audit_log WHERE action = 'Published round'")).toBeGreaterThanOrEqual(rounds.length)
    expect(app.sqlite.pragma('foreign_key_check')).toEqual([])
    expect(app.sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
  })

  it('shows the public all of it, and the rankings', async () => {
    const events = await app.ok<Array<{ id: string }>>('getEvents', [COMP])
    let seen = 0
    for (const event of events) seen += (await app.ok<unknown[]>('getResults', [event.id])).length
    expect(seen).toBe(num('SELECT count(*) AS n FROM results'))
    expect((await app.ok<unknown[]>('getRankingPoints', [{}])).length).toBeGreaterThan(0)
  })
})
