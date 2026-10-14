import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { openDatabase, type Sqlite } from '../db/client.ts'
import { runMigrations } from '../db/migrate.ts'
import { seedSampleData } from '../db/seed.ts'
import { applyChanges } from './apply.ts'

// What the cloud does when the venue sends a row whose natural key the cloud already uses for a different row

let sqlite: Sqlite
beforeAll(() => {
  const opened = openDatabase(':memory:')
  runMigrations(opened.db)
  seedSampleData(opened.db)
  sqlite = opened.sqlite
})
afterAll(() => sqlite.close())

const n = (sql: string, ...args: unknown[]) => (sqlite.prepare(sql).get(...args) as { n: number }).n

// A competitor as the venue sends it: the whole row, with a different back number
const competitorWith = (id: string, backNumber: number) => ({
  ...(sqlite.prepare('SELECT * FROM competitors WHERE id = ?').get(id) as Record<string, string | number | null>),
  back_number: backNumber,
})

describe('a row the venue sends for something the cloud already has under another id', () => {
  it('replaces the cloud\'s round, with its marks, and keeps the venue\'s', () => {
    const old = sqlite.prepare('SELECT id, event_id AS e, type, position, recall_number AS r FROM rounds WHERE id IN (SELECT round_id FROM marks) LIMIT 1').get() as { id: string; e: string; type: string; position: number; r: number | null }
    expect(n('SELECT count(*) AS n FROM marks WHERE round_id = ?', old.id)).toBeGreaterThan(0)
    const applied = applyChanges(sqlite, [
      { entity: 'rounds', operation: 'upsert', payload: { id: 'venue-round', event_id: old.e, type: old.type, position: old.position, recall_number: old.r, status: 'pending' } },
    ])
    expect(applied.applied).toBe(1)
    expect(n('SELECT count(*) AS n FROM rounds WHERE id = ?', old.id)).toBe(0)
    expect(n('SELECT count(*) AS n FROM marks WHERE round_id = ?', old.id)).toBe(0)
    expect(n("SELECT count(*) AS n FROM rounds WHERE id = 'venue-round'")).toBe(1)
    // Sending it again changes nothing
    applyChanges(sqlite, [
      { entity: 'rounds', operation: 'upsert', payload: { id: 'venue-round', event_id: old.e, type: old.type, position: old.position, recall_number: old.r, status: 'pending' } },
    ])
    expect(n('SELECT count(*) AS n FROM rounds WHERE event_id = ? AND type = ?', old.e, old.type)).toBe(1)
  })

  it('replaces an unpaid online entry with the late entry made at the venue', () => {
    const entry = sqlite.prepare('SELECT id, event_id AS e, competitor_id AS c, payment_id AS p FROM entries LIMIT 1').get() as { id: string; e: string; c: string; p: string | null }
    applyChanges(sqlite, [
      { entity: 'entries', operation: 'upsert', payload: { id: 'late-entry', event_id: entry.e, competitor_id: entry.c, payment_id: entry.p, scratched: 0 } },
    ])
    expect(n('SELECT count(*) AS n FROM entries WHERE id = ?', entry.id)).toBe(0)
    expect(n('SELECT count(*) AS n FROM entries WHERE event_id = ? AND competitor_id = ?', entry.e, entry.c)).toBe(1)
  })

  it('never removes a competitor to give another one the same back number: only the number moves', () => {
    const [a, b] = sqlite.prepare('SELECT id, back_number AS b FROM competitors WHERE back_number IS NOT NULL LIMIT 2').all() as Array<{ id: string; b: number }>
    const before = n('SELECT count(*) AS n FROM competitors')
    applyChanges(sqlite, [{ entity: 'competitors', operation: 'upsert', payload: competitorWith(a!.id, b!.b) }])
    expect(n('SELECT count(*) AS n FROM competitors')).toBe(before)
    expect(sqlite.prepare('SELECT back_number AS b FROM competitors WHERE id = ?').get(a!.id)).toEqual({ b: b!.b })
    expect(sqlite.prepare('SELECT back_number AS b FROM competitors WHERE id = ?').get(b!.id)).toEqual({ b: null })
  })

  it('lets two competitors swap numbers in one batch', () => {
    const [a, b] = sqlite.prepare('SELECT id FROM competitors WHERE back_number IS NULL OR back_number IS NOT NULL ORDER BY id LIMIT 2').all() as Array<{ id: string }>
    applyChanges(sqlite, [
      { entity: 'competitors', operation: 'upsert', payload: competitorWith(a!.id, 8001) },
      { entity: 'competitors', operation: 'upsert', payload: competitorWith(b!.id, 8002) },
      { entity: 'competitors', operation: 'upsert', payload: competitorWith(a!.id, 8002) },
      { entity: 'competitors', operation: 'upsert', payload: competitorWith(b!.id, 8001) },
    ])
    expect(sqlite.prepare('SELECT id, back_number AS b FROM competitors WHERE id IN (?, ?) ORDER BY b').all(a!.id, b!.id)).toEqual(
      [{ id: b!.id, b: 8001 }, { id: a!.id, b: 8002 }],
    )
  })

  it('still refuses what it cannot safely settle, such as two events with one number', () => {
    const event = sqlite.prepare('SELECT competition_id AS c, number FROM events LIMIT 1').get() as { c: string; number: number }
    expect(() =>
      applyChanges(sqlite, [
        { entity: 'events', operation: 'upsert', payload: { id: 'other-event', competition_id: event.c, number: event.number, position: 999, age_group: 'adult', class: 'A', discipline: 'latin', dances: '["samba"]', is_solo: 1 } },
      ]),
    ).toThrow(/UNIQUE/)
    expect(n("SELECT count(*) AS n FROM events WHERE id = 'other-event'")).toBe(0)
  })
})
