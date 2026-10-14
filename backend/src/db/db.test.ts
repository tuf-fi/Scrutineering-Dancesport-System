import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
        'adjudicator_pins', 'adjudicators', 'audit_log', 'clubs', 'competitions', 'competitors', 'entries', 'events', 'final_tie_decisions',
        'heat_competitors', 'heats', 'marks', 'outbox', 'panel_members', 'panels', 'payments', 'points_table',
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
