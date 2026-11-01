import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { afterEach, describe, expect, it } from 'vitest'
import { newId, now } from '../ids.ts'
import { openDatabase, type Sqlite } from './client.ts'
import { runMigrations } from './migrate.ts'
import * as schema from './schema.ts'

const open: Sqlite[] = []
const dirs: string[] = []
afterEach(() => {
  for (const s of open.splice(0)) s.close()
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function fresh(path = ':memory:') {
  const handle = openDatabase(path)
  open.push(handle.sqlite)
  runMigrations(handle.db)
  return handle
}

const tableNames = (sqlite: Sqlite) =>
  (sqlite.prepare("select name from sqlite_master where type = 'table' and name not like '%drizzle%' and name not like 'sqlite_%'").all() as Array<{ name: string }>)
    .map((r) => r.name)
    .sort()

describe('database', () => {
  it('creates every table of the data model on a fresh database', () => {
    const { sqlite } = fresh()
    expect(tableNames(sqlite)).toEqual(
      [
        'adjudicator_pins', 'adjudicators', 'athletes', 'audit_log', 'clubs', 'coaches', 'competitions', 'competitors', 'entries', 'events', 'final_tie_decisions',
        'heat_competitors', 'heats', 'marks', 'panel_members', 'panels', 'payments', 'points_table', 'program_slots', 'program_starts',
        'ranking_points', 'results', 'rounds', 'settings', 'staff_users', 'submissions', 'tie_decisions',
      ].sort(),
    )
  })

  it('can run the migrations twice without error', () => {
    const { db } = fresh()
    expect(() => runMigrations(db)).not.toThrow()
  })

  it('turns on write-ahead logging and foreign keys for a database file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bis-db-'))
    dirs.push(dir)
    const { sqlite } = fresh(join(dir, 'nested', 'bis.db'))
    expect(sqlite.pragma('journal_mode', { simple: true })).toBe('wal')
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1)
  })
})

describe('constraints', () => {
  function seed() {
    const { db, sqlite } = fresh()
    const competitionId = newId()
    const eventId = newId()
    const clubId = newId()
    const roundId = newId()
    const adjudicatorId = newId()
    const competitorId = newId()
    db.insert(schema.competitions).values({ id: competitionId, name: 'Open', date: '2026-10-10', venue: 'Gym', organizer: 'Org' }).run()
    db.insert(schema.events).values({ id: eventId, competitionId, number: 1, position: 1, ageGroup: 'junior_1', class: 'E1', discipline: 'latin', dances: ['samba'], isSolo: true }).run()
    db.insert(schema.clubs).values({ id: clubId, name: 'Club', contactName: 'A', contactEmail: 'a@b.c', contactPhone: '1' }).run()
    db.insert(schema.competitors).values({ id: competitorId, names: ['A'], backNumber: 1, clubId }).run()
    db.insert(schema.rounds).values({ id: roundId, eventId, type: 'final', position: 1, recallNumber: null, status: 'marking' }).run()
    db.insert(schema.adjudicators).values({ id: adjudicatorId, name: 'Adj', letter: 'A' }).run()
    return { db, sqlite, competitionId, eventId, clubId, roundId, adjudicatorId, competitorId }
  }

  const mark = (s: ReturnType<typeof seed>) => ({
    id: newId(), roundId: s.roundId, adjudicatorId: s.adjudicatorId, competitorId: s.competitorId,
    dance: 'samba' as const, kind: 'placing' as const, placing: 1, submittedAt: now(),
  })

  it('refuses a second mark for the same adjudicator, competitor and dance', () => {
    const s = seed()
    s.db.insert(schema.marks).values(mark(s)).run()
    expect(() => s.db.insert(schema.marks).values(mark(s)).run()).toThrow(/UNIQUE/)
  })

  it('refuses rows that point at something that does not exist', () => {
    const s = seed()
    expect(() => s.db.insert(schema.entries).values({ id: newId(), eventId: 'missing', competitorId: s.competitorId }).run()).toThrow(/FOREIGN KEY/)
  })

  it('refuses a competitor entered twice in one event', () => {
    const s = seed()
    const entry = () => ({ id: newId(), eventId: s.eventId, competitorId: s.competitorId })
    s.db.insert(schema.entries).values(entry()).run()
    expect(() => s.db.insert(schema.entries).values(entry()).run()).toThrow(/UNIQUE/)
  })

  it('keeps back numbers unique but lets many competitors have none yet', () => {
    const s = seed()
    const add = (backNumber: number | null) =>
      s.db.insert(schema.competitors).values({ id: newId(), names: ['X'], backNumber, clubId: s.clubId }).run()
    expect(() => add(1)).toThrow(/UNIQUE/)
    add(null)
    expect(() => add(null)).not.toThrow()
  })

  it('deletes an event\'s rounds and marks with it', () => {
    const s = seed()
    s.db.insert(schema.marks).values(mark(s)).run()
    s.sqlite.prepare('delete from events where id = ?').run(s.eventId)
    expect(s.sqlite.prepare('select count(*) as n from marks').get()).toEqual({ n: 0 })
  })
})

describe('dropping offline sync (migration 0009)', () => {
  it('upgrades a database that already ran 0008 and keeps its data', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bis-mig-'))
    dirs.push(dir)
    // The migrations as they were before 0009: every file but that one, and a journal without it
    const before = join(dir, 'before')
    cpSync(join(import.meta.dirname, '..', '..', 'drizzle'), before, { recursive: true })
    // Everything from 0009 on is left out
    for (const file of readdirSync(before)) if (/^00(09|[1-9]\d)_.*\.sql$/.test(file)) rmSync(join(before, file))
    const journalPath = join(before, 'meta', '_journal.json')
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: Array<{ tag: string }> }
    journal.entries = journal.entries.filter((e) => e.tag < '0009')
    writeFileSync(journalPath, JSON.stringify(journal))

    const { db, sqlite } = openDatabase(':memory:')
    open.push(sqlite)
    migrate(db, { migrationsFolder: before })
    expect(sqlite.prepare("select count(*) as n from sqlite_master where type = 'trigger' and name like 'sync_%'").get()).toEqual({ n: 45 })

    // Data written while capture was on: triggers fire into the outbox, and a competition is held
    sqlite.prepare("insert into settings (key, value) values ('sync_capture', 'on')").run()
    sqlite.prepare("insert into competitions (id, name, date, venue, organizer, held_by, held_at) values ('c1', 'Open', '2026-10-10', 'Gym', 'Org', 'laptop', 'then')").run()
    sqlite.prepare("insert into events (id, competition_id, number, position, age_group, class, discipline, dances, is_solo) values ('e1', 'c1', 1, 1, 'junior_1', 'E1', 'latin', '[\"samba\"]', 1)").run()
    sqlite.prepare("insert into program_starts (competition_id, start) values ('c1', '08:00')").run()
    expect((sqlite.prepare('select count(*) as n from outbox').get() as { n: number }).n).toBeGreaterThan(0)

    runMigrations(db)

    expect(sqlite.prepare("select count(*) as n from sqlite_master where type = 'trigger' and name like 'sync_%'").get()).toEqual({ n: 0 })
    expect(tableNames(sqlite)).not.toContain('outbox')
    expect((sqlite.prepare("pragma table_info('competitions')").all() as Array<{ name: string }>).map((c) => c.name)).not.toContain('held_by')
    expect(sqlite.prepare("select count(*) as n from settings where key like 'sync_%'").get()).toEqual({ n: 0 })
    expect(sqlite.prepare('select name from competitions').all()).toEqual([{ name: 'Open' }])
    expect(sqlite.prepare('select number from events').all()).toEqual([{ number: 1 }])
    expect(sqlite.prepare('select start from program_starts').all()).toEqual([{ start: '08:00' }])
    // Writing still works with the triggers gone
    expect(() => sqlite.prepare("update events set position = 2 where id = 'e1'").run()).not.toThrow()
  })
})
