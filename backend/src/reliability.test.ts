import type { AdjudicatorSubmission, MarkSubmission } from '@bis/shared'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase } from './db/client.ts'
import { runMigrations } from './db/migrate.ts'
import { seedSampleData } from './db/seed.ts'
import { startTestApp, type TestApp } from './testing.ts'

const dirs: string[] = []
const apps: TestApp[] = []
afterEach(async () => {
  for (const a of apps.splice(0)) await a.close()
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})
const temp = () => {
  const d = mkdtempSync(join(tmpdir(), 'bis-rel-'))
  dirs.push(d)
  return d
}

// The seeded live round: round 2 of the featured event, seven adjudicators, three already submitted
const LIVE = 'comp-sorsogon-2026:e11:round_2'
const PIN = (letterIndex: number) => String(4100 + letterIndex * 111)

async function marksFor(app: TestApp, cookie: string): Promise<MarkSubmission[]> {
  const state = await app.ok<{ task: { recallNumber: number; competitors: Array<{ id: string }>; dances: string[] } }>('getAdjudicatorState', [], cookie)
  const ids = state.task.competitors.slice(0, state.task.recallNumber).map((c) => c.id)
  return state.task.dances.map((dance) => ({ dance: dance as MarkSubmission['dance'], competitorIds: ids }))
}

describe('ten phones at once', () => {
  it('stores every adjudicator\'s marks exactly once, even when phones resend at the same moment', async () => {
    const app = await startTestApp()
    apps.push(app)
    // Panel positions D to G are still to submit; each phone sends its marks three times at once
    const phones = await Promise.all([3, 4, 5, 6].map((i) => app.signIn.adjudicator(PIN(i))))
    const sends = await Promise.all(
      phones.map(async (cookie) => {
        const marks = await marksFor(app, cookie)
        return Promise.all([1, 2, 3].map(() => app.call('submitAdjudicatorMarks', [LIVE, marks], cookie)))
      }),
    )
    expect(sends.flat().map((r) => r.status)).toEqual(Array(12).fill(200))
    const per = app.sqlite.prepare('select adjudicator_id as a, count(*) as n from marks where round_id = ? group by adjudicator_id').all(LIVE) as Array<{ a: string; n: number }>
    expect(per).toHaveLength(7)
    expect(per.every((p) => p.n === 12)).toBe(true)
    expect(app.sqlite.prepare('select count(*) as n from submissions where round_id = ?').get(LIVE)).toEqual({ n: 7 })
    expect((await app.ok<Array<{ status: string }>>('getSubmissions', [LIVE], await app.signIn.staff('scrutineer'))).every((s) => s.status === 'submitted')).toBe(true)
    expect((await app.ok<Array<{ status: string }>>('getCompetitionRounds', ['comp-sorsogon-2026'], await app.signIn.staff('scrutineer'))).find((r) => (r as { roundId?: string }).roundId === LIVE)).toMatchObject({ status: 'review' })
  })

  it('keeps reads working while marks are being written', async () => {
    const app = await startTestApp()
    apps.push(app)
    const scrutineer = await app.signIn.staff('scrutineer')
    const phones = await Promise.all([3, 4, 5, 6].map((i) => app.signIn.adjudicator(PIN(i))))
    const writes = phones.map(async (cookie) => app.call('submitAdjudicatorMarks', [LIVE, await marksFor(app, cookie)], cookie))
    const reads = Array.from({ length: 20 }, () => app.call('getRecallTable', [LIVE], scrutineer))
    const results = await Promise.all([...writes, ...reads])
    expect(results.every((r) => r.status === 200)).toBe(true)
  })
})

describe('a crash in the middle of saving', () => {
  it('keeps what was saved and drops what was not', async () => {
    const dir = temp()
    const path = join(dir, 'bis.db')
    {
      const { db, sqlite } = openDatabase(path)
      runMigrations(db)
      seedSampleData(db)
      sqlite.close()
    }
    const competitor = (() => {
      const { sqlite } = openDatabase(path)
      const row = sqlite.prepare('select competitor_id as c from heat_competitors h join heats on heats.id = h.heat_id where heats.round_id = ? limit 1').get(LIVE) as { c: string }
      sqlite.close()
      return row.c
    })()

    // A child process saves one adjudicator's marks, opens a second change, and is killed (no clean shutdown)
    const child = spawnSync(process.execPath, ['--import', 'tsx', join(import.meta.dirname, 'crash-child.ts'), path, LIVE, 'adj-d', competitor], {
      cwd: join(import.meta.dirname, '..'),
      encoding: 'utf8',
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    })
    expect(child.stdout).toContain('ready')
    expect(child.signal ?? child.status).not.toBe(0)

    // Restarting the server on the same file: nothing saved is lost, nothing half-written appears
    const app = await startTestApp({ path, seed: false })
    apps.push(app)
    expect(app.sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
    expect(app.sqlite.prepare("select count(*) as n from marks where round_id = ? and adjudicator_id = 'adj-d'").get(LIVE)).toEqual({ n: 1 })
    expect(app.sqlite.prepare("select count(*) as n from submissions where round_id = ? and adjudicator_id = 'adj-d'").get(LIVE)).toEqual({ n: 1 })
    expect(app.sqlite.prepare("select count(*) as n from competitions where id = 'half-written'").get()).toEqual({ n: 0 })
    // And it carries on: the scrutineer still sees the round with its four adjudicators in
    const board = await app.ok<AdjudicatorSubmission[]>('getSubmissions', [LIVE], await app.signIn.staff('scrutineer', 'bis2026'))
    expect(board.filter((b) => b.status === 'submitted')).toHaveLength(4)
  })
})

describe('backups', () => {
  it('copies the database to every folder and a copy restores the same competition', async () => {
    const good = temp()
    const app = await startTestApp({ backupDirs: [good] })
    apps.push(app)
    const status = await app.backups.run()
    expect(status.targets).toEqual([expect.objectContaining({ path: good, ok: true, error: null })])
    expect(status.lastBackupAt).not.toBeNull()
    const files = readdirSync(good).filter((f) => f.endsWith('.db'))
    expect(files).toHaveLength(1)

    // Restore: open the copy as a database and compare it with the live one
    const restored = openDatabase(join(good, files[0]!))
    const count = (s: { prepare: (q: string) => { get: () => unknown } }, table: string) => s.prepare(`select count(*) as n from ${table}`).get()
    for (const table of ['competitions', 'events', 'entries', 'marks', 'results', 'ranking_points', 'staff_users', 'audit_log']) {
      expect(count(restored.sqlite, table)).toEqual(count(app.sqlite, table))
    }
    expect(restored.sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
    restored.sqlite.close()
  })

  it('reports a folder that cannot be written and still copies to the others', async () => {
    const good = temp()
    const blocker = join(temp(), 'a-file')
    writeFileSync(blocker, 'not a folder')
    const app = await startTestApp({ backupDirs: [join(blocker, 'usb'), good] })
    apps.push(app)
    const status = await app.backups.run()
    expect(status.targets[0]).toMatchObject({ ok: false, lastBackupAt: null })
    expect(status.targets[0]!.error).toBeTruthy()
    expect(status.targets[1]).toMatchObject({ ok: true })
    expect(readdirSync(good).some((f) => f.endsWith('.db'))).toBe(true)

    // The scrutineer and admin can see this; others cannot
    const seen = await app.ok<{ targets: Array<{ ok: boolean }> }>('getBackupStatus', [], await app.signIn.staff('scrutineer'))
    expect(seen.targets.map((t) => t.ok)).toEqual([false, true])
    expect((await app.call('getBackupStatus', [], await app.signIn.staff('mc'))).status).toBe(403)
  })

  it('keeps a copy taken while marks are being written consistent', async () => {
    const good = temp()
    const app = await startTestApp({ backupDirs: [good] })
    apps.push(app)
    const phones = await Promise.all([3, 4, 5, 6].map((i) => app.signIn.adjudicator(PIN(i))))
    const writes = phones.map(async (cookie) => app.call('submitAdjudicatorMarks', [LIVE, await marksFor(app, cookie)], cookie))
    await Promise.all([app.backups.run(), ...writes])
    const copy = openDatabase(join(good, readdirSync(good).find((f) => f.endsWith('.db'))!))
    expect(copy.sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
    // Every submission in the copy has all of its marks: nothing is cut in half
    const bad = copy.sqlite
      .prepare('select s.adjudicator_id as a, (select count(*) from marks m where m.round_id = s.round_id and m.adjudicator_id = s.adjudicator_id) as n from submissions s where s.round_id = ?')
      .all(LIVE) as Array<{ a: string; n: number }>
    expect(bad.every((b) => b.n === 12)).toBe(true)
    copy.sqlite.close()
  })

  it('keeps only the newest thirty copies in a folder', async () => {
    const dir = temp()
    for (let i = 0; i < 35; i++) writeFileSync(join(dir, `bis-20260101-0000${String(i).padStart(2, '0')}.db`), 'old')
    const app = await startTestApp({ backupDirs: [dir] })
    apps.push(app)
    await app.backups.run()
    expect(readdirSync(dir).filter((f) => f.endsWith('.db'))).toHaveLength(30)
    expect(existsSync(dir)).toBe(true)
  })
})
