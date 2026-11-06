import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { exportDay, importDay, type DayPackage } from './db/dayPackage.ts'
import { startTestApp, type TestApp } from './testing.ts'

// A competition day done on the venue laptop (A) goes back to the online server (B) as one file

let venue: TestApp
let online: TestApp
let competitionId = ''

const rows = (app: TestApp, sql: string, ...args: unknown[]) => app.sqlite.prepare(sql).all(...(args as never[]))
const one = (app: TestApp, sql: string, ...args: unknown[]) => app.sqlite.prepare(sql).get(...(args as never[])) as Record<string, unknown>

beforeAll(async () => {
  venue = await startTestApp()
  online = await startTestApp()
  competitionId = (one(venue, 'SELECT id FROM competitions WHERE floor_round_id IS NOT NULL') as { id: string }).id
})
afterAll(async () => {
  await venue.close()
  await online.close()
})

describe('the competition day file', () => {
  it('carries what the venue did, and a trial run changes nothing', () => {
    // The day at the venue: a result changes, a dancer is added with a back number, a back number moves, the floor is cleared
    const aResult = one(venue, "SELECT id FROM results WHERE event_id IN (SELECT id FROM events WHERE competition_id = ?) LIMIT 1", competitionId) as { id: string } | undefined
    if (aResult) venue.sqlite.prepare('UPDATE results SET place_from = place_from, approved_by = ? WHERE id = ?').run('Venue scrutineer', aResult.id)
    const team = one(venue, 'SELECT id FROM teams LIMIT 1') as { id: string }
    venue.sqlite.prepare('INSERT INTO competitors (id, names, team_id, back_number) VALUES (?, ?, ?, ?)').run('c-venue', JSON.stringify(['Late Dancer']), team.id, 999)
    const first = one(venue, "SELECT id FROM competitors WHERE id <> 'c-venue' AND back_number IS NOT NULL LIMIT 1") as { id: string }
    venue.sqlite.prepare('UPDATE competitors SET back_number = 998 WHERE id = ?').run(first.id)
    venue.sqlite.prepare('UPDATE competitions SET floor_round_id = NULL WHERE id = ?').run(competitionId)
    venue.sqlite.prepare('DELETE FROM marks WHERE id = (SELECT id FROM marks WHERE round_id IN (SELECT id FROM rounds) LIMIT 1)').run()

    const pkg = exportDay(venue.sqlite, competitionId)
    expect(pkg.format).toBe('bis-day-1')
    expect(pkg.replaced.marks!.length).toBe((rows(venue, 'SELECT id FROM marks WHERE round_id IN (SELECT r.id FROM rounds r JOIN events e ON e.id = r.event_id WHERE e.competition_id = ?)', competitionId)).length)

    const before = {
      marks: rows(online, 'SELECT id FROM marks').length,
      competitors: rows(online, 'SELECT id FROM competitors').length,
      floor: one(online, 'SELECT floor_round_id AS f FROM competitions WHERE id = ?', competitionId).f,
    }
    const trial = importDay(online.sqlite, pkg, { dryRun: true })
    expect(trial.added.competitors).toBe(1)
    expect(rows(online, 'SELECT id FROM marks').length).toBe(before.marks)
    expect(rows(online, 'SELECT id FROM competitors').length).toBe(before.competitors)
    expect(one(online, 'SELECT floor_round_id AS f FROM competitions WHERE id = ?', competitionId).f).toBe(before.floor)

    importDay(online.sqlite, pkg)
    // The online server now has the venue's day
    for (const table of ['marks', 'submissions', 'results', 'ranking_points', 'rounds', 'entries', 'payments']) {
      expect(rows(online, `SELECT COUNT(*) AS n FROM ${table}`)).toEqual(rows(venue, `SELECT COUNT(*) AS n FROM ${table}`))
    }
    expect(one(online, "SELECT names, back_number AS n FROM competitors WHERE id = 'c-venue'")).toMatchObject({ n: 999 })
    expect(one(online, 'SELECT back_number AS n FROM competitors WHERE id = ?', first.id).n).toBe(998)
    expect(one(online, 'SELECT floor_round_id AS f FROM competitions WHERE id = ?', competitionId).f).toBeNull()
    expect(online.sqlite.pragma('foreign_key_check')).toEqual([])
    expect(one(online, "SELECT action FROM audit_log WHERE actor_id = 'day-import'").action).toBe('Imported the competition day')

    // Loading the same file again changes nothing more
    importDay(online.sqlite, pkg)
    expect(rows(online, 'SELECT id FROM competitors WHERE id = ?', 'c-venue')).toHaveLength(1)
  })

  it('refuses a file that is not a day file, from another version, or for another competition', () => {
    const pkg = exportDay(venue.sqlite, competitionId)
    expect(() => importDay(online.sqlite, { ...pkg, format: 'other' } as unknown as DayPackage)).toThrow(/not a BIS competition day file/)
    expect(() => importDay(online.sqlite, { ...pkg, competitionId: 'nowhere' })).toThrow(/no competition/)
    const odd: DayPackage = { ...pkg, replaced: { ...pkg.replaced, marks: pkg.replaced.marks!.map((m) => ({ ...m, mystery: 1 })) } }
    expect(() => importDay(online.sqlite, odd)).toThrow(/different versions/)
  })
})
