import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBackups } from './backup.ts'
import { openDatabase } from './db/client.ts'
import { runMigrations } from './db/migrate.ts'
import { seedSampleData } from './db/seed.ts'
import { inspectBackup, newestBackup, restoreDatabase } from './restore.ts'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})
const temp = () => {
  const d = mkdtempSync(join(tmpdir(), 'bis-restore-'))
  dirs.push(d)
  return d
}

// A live competition on "Laptop 2" with a backup in a folder, as the server makes them
async function backedUpCompetition() {
  const laptop2 = temp()
  const backups = join(temp(), 'backups')
  const { db, sqlite } = openDatabase(join(laptop2, 'bis.db'))
  runMigrations(db)
  seedSampleData(db)
  const service = createBackups(sqlite, [backups], 0)
  await service.run()
  const copy = join(backups, readdirSync(backups).find((f) => f.endsWith('.db'))!)
  return { sqlite, backups, copy, live: join(laptop2, 'bis.db') }
}

describe('Laptop 3 taking over', () => {
  it('puts the newest backup in place and the database opens with the competition in it', async () => {
    const lap2 = await backedUpCompetition()
    const laptop3 = join(temp(), 'data', 'bis.db')
    const result = restoreDatabase({ from: newestBackup([lap2.backups])!, to: laptop3 })
    lap2.sqlite.close()
    expect(result.keptAs).toBeNull()
    expect(result).toMatchObject({ competitions: 3, events: 162 })
    expect(result.marks).toBeGreaterThan(300)

    // The new server opens it and the live round is still on the floor with three adjudicators in
    const { db, sqlite } = openDatabase(laptop3)
    runMigrations(db)
    expect(sqlite.prepare('select floor_round_id as r from competitions where id = ?').get('comp-sorsogon-2026')).toEqual({ r: 'comp-sorsogon-2026:e11:round_2' })
    expect(sqlite.prepare("select count(*) as n from submissions where round_id = 'comp-sorsogon-2026:e11:round_2'").get()).toEqual({ n: 3 })
    sqlite.close()
  })

  it('tells how much of the competition the backup holds', async () => {
    const lap2 = await backedUpCompetition()
    lap2.sqlite.close()
    const summary = inspectBackup(lap2.copy)
    expect(summary.lastAction).toMatch(/^2026-/)
    expect(summary).toMatchObject({ competitions: 3, events: 162 })
  })

  it('finds the newest copy across several folders and ignores other files', () => {
    const a = temp()
    const b = temp()
    const old = join(a, 'bis-20261010-090000.db')
    const recent = join(b, 'bis-20261010-100000.db')
    writeFileSync(old, 'x')
    writeFileSync(recent, 'x')
    writeFileSync(join(b, 'notes.txt'), 'x')
    writeFileSync(join(b, 'bis-other.txt'), 'x')
    utimesSync(old, new Date('2026-10-10T01:00:00Z'), new Date('2026-10-10T01:00:00Z'))
    utimesSync(recent, new Date('2026-10-10T02:00:00Z'), new Date('2026-10-10T02:00:00Z'))
    expect(newestBackup([a, b, join(a, 'missing')])).toBe(recent)
    expect(newestBackup([join(a, 'missing')])).toBeNull()
    expect(newestBackup([temp()])).toBeNull()
  })
})

describe('refusing what would do harm', () => {
  it('will not use a file that is not a database, or is not BIS\'s, or does not exist', () => {
    const dir = temp()
    const garbage = join(dir, 'bis-garbage.db')
    writeFileSync(garbage, 'this is not a database at all, just some text padded out to be long enough to look real'.repeat(20))
    expect(() => inspectBackup(garbage)).toThrow(/not a database|cannot be used/)
    const other = join(dir, 'bis-other.db')
    const { sqlite } = openDatabase(other)
    sqlite.exec('create table something (id integer)')
    sqlite.close()
    expect(() => inspectBackup(other)).toThrow(/not a BIS database/)
    expect(() => inspectBackup(join(dir, 'missing.db'))).toThrow(/no file/)
    expect(() => restoreDatabase({ from: garbage, to: join(dir, 'live.db') })).toThrow()
    expect(readdirSync(dir).includes('live.db')).toBe(false)
  })

  it('will not overwrite a database that is there unless asked, and then keeps it', async () => {
    const lap2 = await backedUpCompetition()
    lap2.sqlite.close()
    const dir = temp()
    const live = join(dir, 'bis.db')
    writeFileSync(live, 'the database that must not be lost')
    writeFileSync(live + '-wal', 'stale log')
    expect(() => restoreDatabase({ from: lap2.copy, to: live })).toThrow(/already exists.*--replace/)
    expect(readdirSync(dir)).toEqual(['bis.db', 'bis.db-wal'])

    const result = restoreDatabase({ from: lap2.copy, to: live, replace: true })
    expect(result.keptAs).toMatch(/bis\.db\.replaced-\d{8}-\d{6}$/)
    const files = readdirSync(dir)
    expect(files).toContain(basename(result.keptAs!))
    // The old log went with the old database: it is kept beside it and is not the one the restored database uses
    expect(readFileSync(result.keptAs! + '-wal', 'utf8')).toBe('stale log')
    if (existsSync(live + '-wal')) expect(readFileSync(live + '-wal', 'utf8')).not.toBe('stale log')
    expect(inspectBackup(live).competitions).toBe(3)
  })

  it('creates the data folder when Laptop 3 has none yet', async () => {
    const lap2 = await backedUpCompetition()
    lap2.sqlite.close()
    const to = join(temp(), 'does', 'not', 'exist', 'bis.db')
    mkdirSync(join(to, '..', '..'), { recursive: true })
    expect(restoreDatabase({ from: lap2.copy, to }).competitions).toBe(3)
  })
})
