import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase, type Sqlite } from '../db/client.ts'
import { runMigrations } from '../db/migrate.ts'
import { seedSampleData } from '../db/seed.ts'
import { applyChanges, applySnapshot, type SyncItem } from './apply.ts'
import { captureIsOn, setCapture, withoutCapture } from './capture.ts'
import { buildSnapshot } from './snapshot.ts'
import { UPLOAD_TABLES } from './tables.ts'
import { captureMigrationSql } from './triggers.ts'

const COMP = 'comp-sorsogon-2026'
const open: Sqlite[] = []
afterEach(() => {
  for (const s of open.splice(0)) s.close()
})

function database(seed: boolean) {
  const { db, sqlite } = openDatabase(':memory:')
  runMigrations(db)
  if (seed) seedSampleData(db)
  open.push(sqlite)
  return sqlite
}

type Outbox = { id: string; entity: string; entity_id: string; operation: 'upsert' | 'delete'; payload: string }
const outbox = (s: Sqlite): Outbox[] => s.prepare('select id, entity, entity_id, operation, payload from outbox order by rowid').all() as Outbox[]
const items = (s: Sqlite): SyncItem[] => outbox(s).map((o) => ({ entity: o.entity, operation: o.operation, payload: JSON.parse(o.payload) }))
const one = <T = unknown>(s: Sqlite, sql: string, ...args: unknown[]) => s.prepare(sql).get(...args) as T

describe('the capture triggers', () => {
  it('are exactly what the schema calls for', () => {
    const dir = join(import.meta.dirname, '..', '..', 'drizzle')
    const file = readdirSync(dir).find((f) => /_sync_capture\.sql$/.test(f))!
    // If this fails, a synced table changed: run `pnpm --filter @bis/backend db:sync-migration`
    expect(readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n')).toBe(captureMigrationSql())
  })

  it('queue nothing while capture is off, which is how the cloud and a fresh venue behave', () => {
    const s = database(true)
    s.prepare('update competitors set back_number = 9999 where id = (select id from competitors limit 1)').run()
    expect(outbox(s)).toEqual([])
    expect(captureIsOn(s)).toBe(false)
  })

  it('queue every insert, update and delete once capture is on', () => {
    const s = database(true)
    setCapture(s, true)
    const competitor = one<{ id: string }>(s, 'select id from competitors where back_number is not null limit 1')
    s.prepare('update competitors set back_number = 9999 where id = ?').run(competitor.id)
    const [update] = outbox(s)
    expect(update).toMatchObject({ entity: 'competitors', entity_id: competitor.id, operation: 'upsert' })
    expect(JSON.parse(update!.payload)).toMatchObject({ id: competitor.id, back_number: 9999 })

    const entry = one<{ id: string }>(s, 'select id from entries limit 1')
    s.prepare('delete from entries where id = ?').run(entry.id)
    expect(outbox(s).at(-1)).toMatchObject({ entity: 'entries', entity_id: entry.id, operation: 'delete' })

    s.prepare("insert into tie_decisions (round_id, choice, proposed_by, proposed_at) values (?, 'more', 'x', 'now')").run(
      one<{ id: string }>(s, 'select id from rounds limit 1').id,
    )
    expect(outbox(s).at(-1)).toMatchObject({ entity: 'tie_decisions', operation: 'upsert' })
  })

  it('name the row by its whole key when the key has two parts', () => {
    const s = database(true)
    setCapture(s, true)
    const sub = one<{ round_id: string; adjudicator_id: string }>(s, 'select round_id, adjudicator_id from submissions limit 1')
    s.prepare('delete from submissions where round_id = ? and adjudicator_id = ?').run(sub.round_id, sub.adjudicator_id)
    const row = outbox(s).at(-1)!
    expect(row).toMatchObject({ entity: 'submissions', entity_id: `${sub.round_id}:${sub.adjudicator_id}`, operation: 'delete' })
    expect(JSON.parse(row.payload)).toMatchObject({ round_id: sub.round_id, adjudicator_id: sub.adjudicator_id })
  })

  it('never carry a receipt picture, and never queue the outbox itself or the things only the cloud owns', () => {
    const s = database(true)
    setCapture(s, true)
    const payment = one<{ id: string }>(s, 'select id from payments where receipt is not null limit 1')
    s.prepare("update payments set status = 'approved' where id = ?").run(payment.id)
    const row = outbox(s).at(-1)!
    expect(row.entity).toBe('payments')
    expect(JSON.parse(row.payload)).not.toHaveProperty('receipt')
    expect(JSON.parse(row.payload)).toMatchObject({ id: payment.id, status: 'approved' })

    const before = outbox(s).length
    s.prepare("update staff_users set name = 'Changed' where username = 'admin'").run()
    s.prepare("update clubs set name = name where id = (select id from clubs limit 1)").run()
    s.prepare("update competitions set floor_round_id = null").run()
    s.prepare("update adjudicators set name = name").run()
    expect(outbox(s)).toHaveLength(before)
  })

  it('roll back with the change they belong to', () => {
    const s = database(true)
    setCapture(s, true)
    const competitor = one<{ id: string }>(s, 'select id from competitors limit 1')
    expect(() =>
      s.transaction(() => {
        s.prepare('update competitors set back_number = 8888 where id = ?').run(competitor.id)
        throw new Error('the request failed')
      })(),
    ).toThrow()
    expect(outbox(s)).toEqual([])
  })

  it('exist for every table that is uploaded', () => {
    const s = database(false)
    const triggers = (s.prepare("select name from sqlite_master where type = 'trigger'").all() as Array<{ name: string }>).map((t) => t.name)
    expect(triggers).toHaveLength(UPLOAD_TABLES.length * 3)
    for (const table of UPLOAD_TABLES) for (const e of ['insert', 'update', 'delete']) expect(triggers).toContain(`sync_${e}_${table.name}`)
  })

  it('can be switched off for a stretch of work and put back as they were', () => {
    const s = database(true)
    setCapture(s, true)
    withoutCapture(s, () => {
      expect(captureIsOn(s)).toBe(false)
      s.prepare('update competitors set back_number = 7777 where id = (select id from competitors limit 1)').run()
    })
    expect(captureIsOn(s)).toBe(true)
    expect(outbox(s)).toEqual([])
    expect(() => withoutCapture(s, () => { throw new Error('boom') })).toThrow('boom')
    expect(captureIsOn(s)).toBe(true)
  })
})

describe('applying the venue\'s changes on the cloud', () => {
  // Two copies of the same competition: the venue makes changes, the cloud receives them
  function pair() {
    const venue = database(true)
    const cloud = database(true)
    setCapture(venue, true)
    return { venue, cloud }
  }

  it('brings the cloud to the same state, and a repeat changes nothing', () => {
    const { venue, cloud } = pair()
    const competitor = one<{ id: string }>(venue, 'select id from competitors where back_number is not null limit 1')
    venue.prepare('update competitors set back_number = 4321 where id = ?').run(competitor.id)
    venue.prepare("update rounds set status = 'published', published_at = '2026-10-10T05:00:00Z' where id = (select id from rounds limit 1)").run()
    venue.prepare("delete from marks where id = (select id from marks limit 1)").run()
    const changes = items(venue)
    expect(changes.length).toBeGreaterThan(2)

    const first = applyChanges(cloud, changes)
    expect(first.applied).toBe(changes.length)
    expect(first.published).toHaveLength(1)
    expect(one<{ b: number }>(cloud, 'select back_number as b from competitors where id = ?', competitor.id).b).toBe(4321)

    const second = applyChanges(cloud, changes)
    expect(second.applied).toBe(changes.length)
    expect(one<{ n: number }>(cloud, 'select count(*) as n from marks').n).toBe(one<{ n: number }>(venue, 'select count(*) as n from marks').n)
    expect(one<{ b: number }>(cloud, 'select back_number as b from competitors where id = ?', competitor.id).b).toBe(4321)
  })

  it('queues nothing on the cloud, and leaves a payment receipt alone', () => {
    const { venue, cloud } = pair()
    setCapture(cloud, true) // even a cloud that was set to capture must not echo what it receives
    const payment = one<{ id: string }>(venue, 'select id from payments where receipt is not null limit 1')
    venue.prepare("update payments set status = 'paid_at_venue' where id = ?").run(payment.id)
    const receiptBefore = one<{ r: string }>(cloud, 'select receipt as r from payments where id = ?', payment.id).r
    applyChanges(cloud, items(venue))
    expect(one<{ s: string; r: string }>(cloud, 'select status as s, receipt as r from payments where id = ?', payment.id)).toEqual({ s: 'paid_at_venue', r: receiptBefore })
    expect(outbox(cloud)).toEqual([])
    expect(captureIsOn(cloud)).toBe(true)
  })

  it('carries new rows with their parents, in order', () => {
    const { venue, cloud } = pair()
    const club = one<{ id: string }>(venue, 'select id from clubs limit 1')
    const event = one<{ id: string }>(venue, "select id from events where is_solo = 1 and competition_id = ? limit 1", COMP)
    venue.prepare("insert into competitors (id, names, age_group, back_number, club_id) values ('new-1', '[\"New Dancer\"]', null, 4999, ?)").run(club.id)
    venue.prepare("insert into payments (id, club_id, competition_id, late, amount_due, status) values ('pay-new', ?, ?, 1, 500, 'paid_at_venue')").run(club.id, COMP)
    venue.prepare("insert into entries (id, event_id, competitor_id, scratched, payment_id, late) values ('entry-new', ?, 'new-1', 0, 'pay-new', 1)").run(event.id)
    applyChanges(cloud, items(venue))
    expect(one<{ n: number }>(cloud, "select count(*) as n from entries where id = 'entry-new' and late = 1").n).toBe(1)
    expect(one<{ names: string }>(cloud, "select names from competitors where id = 'new-1'").names).toBe('["New Dancer"]')
  })

  it('is all or nothing: one bad change in a batch changes nothing', () => {
    const { venue, cloud } = pair()
    const competitor = one<{ id: string; back_number: number }>(venue, 'select id, back_number from competitors where back_number is not null limit 1')
    venue.prepare('update competitors set back_number = 1234 where id = ?').run(competitor.id)
    const good = items(venue)
    const bad: SyncItem = { entity: 'entries', operation: 'upsert', payload: { id: 'orphan', event_id: 'no-such-event', competitor_id: competitor.id, scratched: 0, late: 0 } }
    expect(() => applyChanges(cloud, [...good, bad])).toThrow(/FOREIGN KEY/)
    expect(one<{ b: number }>(cloud, 'select back_number as b from competitors where id = ?', competitor.id).b).toBe(competitor.back_number)
  })

  it('refuses a change to something the venue does not send, and ignores columns that do not exist', () => {
    const { cloud } = pair()
    expect(() => applyChanges(cloud, [{ entity: 'staff_users', operation: 'upsert', payload: { id: 'x', role: 'admin' } }])).toThrow(/not something the venue sends/)
    expect(() => applyChanges(cloud, [{ entity: 'competitors', operation: 'upsert', payload: { names: '[]' } }])).toThrow(/missing its key/)
    expect(() => applyChanges(cloud, [{ entity: 'competitors', operation: 'upsert', payload: { id: 'x"; drop table competitors; --', names: '["A"]', club_id: 'nope' } }])).toThrow()
    const competitor = one<{ id: string; names: string; club_id: string }>(cloud, 'select id, names, club_id from competitors limit 1')
    applyChanges(cloud, [
      { entity: 'competitors', operation: 'upsert', payload: { id: competitor.id, names: competitor.names, club_id: competitor.club_id, back_number: 5555, password_hash: 'x', bogus: 1 } },
    ])
    expect(one<{ b: number }>(cloud, 'select back_number as b from competitors where id = ?', competitor.id).b).toBe(5555)
    expect(one<{ n: number }>(cloud, 'select count(*) as n from competitors').n).toBeGreaterThan(100)
  })

  it('reports rankings changes and published rounds so spectators can be told', () => {
    const { cloud } = pair()
    const event = one<{ id: string }>(cloud, 'select id from events limit 1')
    const round = applyChanges(cloud, [
      { entity: 'rounds', operation: 'upsert', payload: { id: 'r-pub', event_id: event.id, type: 'final', position: 9, recall_number: null, status: 'published', published_at: 'now' } },
    ])
    expect(round.published).toEqual([{ roundId: 'r-pub', eventId: event.id }])
    expect(round.rankingsChanged).toBe(false)
    expect(applyChanges(cloud, [{ entity: 'results', operation: 'delete', payload: { id: 'none' } }]).rankingsChanged).toBe(true)
  })
})

describe('downloading a competition from the cloud', () => {
  it('gives a venue everything it needs, with nothing missing and nothing private', () => {
    const cloud = database(true)
    const venue = database(false)
    const snapshot = buildSnapshot(cloud, COMP)

    // Only paid entries come; the rest are counted
    const entries = snapshot.tables.entries!
    const statuses = new Set(
      entries.map((e) => (e.payment_id ? one<{ s: string }>(cloud, 'select status as s from payments where id = ?', e.payment_id).s : 'none')),
    )
    expect([...statuses].every((s) => s === 'approved' || s === 'paid_at_venue' || s === 'none')).toBe(true)
    expect(snapshot.excluded.entries).toBeGreaterThan(0)
    const all = one<{ n: number }>(cloud, 'select count(*) as n from entries join events on events.id = entries.event_id where events.competition_id = ? and entries.scratched = 0', COMP).n
    expect(entries.length + snapshot.excluded.entries).toBe(all)

    // Nothing private travels
    const text = JSON.stringify(snapshot)
    expect(text).not.toContain('password_hash')
    expect(text).not.toContain('data:image/svg')
    expect(snapshot.tables.competitions!.every((c) => !('floor_round_id' in c) && !('held_by' in c))).toBe(true)

    // It applies to an empty database with every link in place
    const applied = applySnapshot(venue, snapshot)
    expect(applied.added.entries).toBe(entries.length)
    expect(venue.pragma('foreign_key_check')).toEqual([])
    expect(one<{ n: number }>(venue, 'select count(*) as n from competitors').n).toBeGreaterThan(0)
    expect(one<{ n: number }>(venue, 'select count(*) as n from points_table').n).toBe(8)
    expect(one<{ n: number }>(venue, 'select count(*) as n from adjudicator_pins where competition_id = ?', COMP).n).toBeGreaterThan(0)
    // The history comes too, so rankings and each dancer's results can be shown
    expect(one<{ n: number }>(venue, 'select count(*) as n from ranking_points').n).toBe(one<{ n: number }>(cloud, 'select count(*) as n from ranking_points').n)
    // The event-day data starts empty: it is the venue's to create
    expect(one<{ n: number }>(venue, 'select count(*) as n from rounds').n).toBe(0)
    expect(one<{ n: number }>(venue, 'select count(*) as n from marks').n).toBe(0)
  })

  it('queues nothing, and leaves capture as it was', () => {
    const cloud = database(true)
    const venue = database(false)
    setCapture(venue, true)
    applySnapshot(venue, buildSnapshot(cloud, COMP))
    expect(outbox(venue)).toEqual([])
    expect(captureIsOn(venue)).toBe(true)
  })

  it('never overwrites what the venue has done since: back numbers, scratches, late entries', () => {
    const cloud = database(true)
    const venue = database(false)
    const snapshot = buildSnapshot(cloud, COMP)
    applySnapshot(venue, snapshot)
    const competitor = one<{ id: string }>(venue, 'select id from competitors where back_number is not null limit 1')
    venue.prepare('update competitors set back_number = 9001 where id = ?').run(competitor.id)
    const entry = one<{ id: string }>(venue, 'select id from entries limit 1')
    venue.prepare('update entries set scratched = 1 where id = ?').run(entry.id)

    const again = applySnapshot(venue, buildSnapshot(cloud, COMP))
    expect(again.added.entries).toBe(0)
    expect(again.added.competitors).toBe(0)
    expect(one<{ b: number }>(venue, 'select back_number as b from competitors where id = ?', competitor.id).b).toBe(9001)
    expect(one<{ s: number }>(venue, 'select scratched as s from entries where id = ?', entry.id).s).toBe(1)
  })

  it('brings in entries approved since the last download, and a payment that has since been approved', () => {
    const cloud = database(true)
    const venue = database(false)
    applySnapshot(venue, buildSnapshot(cloud, COMP))
    const before = one<{ n: number }>(venue, 'select count(*) as n from entries').n

    // Online, the admin approves a payment that was waiting; at the venue the same payment is still "for checking"
    const waiting = one<{ id: string }>(cloud, "select id from payments where status = 'for_checking' limit 1")
    cloud.prepare("update payments set status = 'approved', checked_by = 'staff-admin', checked_at = 'now' where id = ?").run(waiting.id)
    applySnapshot(venue, buildSnapshot(cloud, COMP))
    expect(one<{ n: number }>(venue, 'select count(*) as n from entries').n).toBeGreaterThan(before)

    // A payment the venue marked paid in cash is never reverted by the cloud
    const cash = one<{ id: string }>(venue, "select id from payments where status = 'approved' limit 1")
    venue.prepare("update payments set status = 'paid_at_venue' where id = ?").run(cash.id)
    applySnapshot(venue, buildSnapshot(cloud, COMP))
    expect(one<{ s: string }>(venue, 'select status as s from payments where id = ?', cash.id).s).toBe('paid_at_venue')
  })

  it('refuses a competition that does not exist', () => {
    expect(() => buildSnapshot(database(true), 'nope')).toThrow(/not found/)
  })
})
