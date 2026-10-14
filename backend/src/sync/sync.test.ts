import type { CloudCompetition, MarkSubmission, PullSummary, RoundRow, SyncStatus } from '@bis/shared'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import { hashPassword } from '../auth/password.ts'
import { loadConfig } from '../config.ts'
import { openDatabase, type Sqlite } from '../db/client.ts'
import { runMigrations } from '../db/migrate.ts'
import { SAMPLE_PASSWORD, seedSampleData } from '../db/seed.ts'
import { silentHub } from '../realtime/hub.ts'

// A real cloud server (listening) and a real venue server, syncing over HTTP, from a cloud that has a whole sample
// competition and a venue that starts empty.

const COMP = 'comp-sorsogon-2026'
const TOKEN_A = 'venue-a-secret-0123456789'
const TOKEN_B = 'venue-b-secret-0123456789'

let dir = ''
let port = 0
let cloud: Awaited<ReturnType<typeof buildApp>>
let cloudSqlite: Sqlite
let cloudHub = silentHub()
let venue: Awaited<ReturnType<typeof buildApp>>
let venueSqlite: Sqlite
let venueHub = silentHub()

type Reply<T> = { status: number; data: T; error?: string }
async function call<T = unknown>(app: typeof cloud, name: string, args: unknown[] = [], cookie?: string): Promise<Reply<T>> {
  const res = await app.inject({ method: 'POST', url: `/api/call/${name}`, payload: { args }, headers: cookie ? { cookie } : {} })
  const body = res.json() as { data?: T; error?: string }
  return { status: res.statusCode, data: body.data as T, error: body.error }
}
async function ok<T = unknown>(app: typeof cloud, name: string, args: unknown[], cookie?: string): Promise<T> {
  const r = await call<T>(app, name, args, cookie)
  if (r.status !== 200) throw new Error(`${name} failed (${r.status}): ${r.error}`)
  return r.data
}
async function signIn(app: typeof cloud, url: string, payload: object): Promise<string> {
  const res = await app.inject({ method: 'POST', url, payload })
  if (res.statusCode !== 200) throw new Error(`sign-in failed: ${res.body}`)
  return String(res.headers['set-cookie']).split(';')[0]!
}
const staff = (app: typeof cloud, username: string, password: string) => signIn(app, '/api/auth/staff', { username, password })

const venueConfig = (overrides: Record<string, string> = {}) =>
  loadConfig({ FRONTEND_DIR: '', CLOUD_URL: `http://127.0.0.1:${port}`, SYNC_TOKEN: TOKEN_A, VENUE_ID: 'venue-a', ...overrides })

async function startCloud(listenOn = 0) {
  cloudHub = silentHub()
  const opened = openDatabase(join(dir, 'cloud.db'))
  cloudSqlite = opened.sqlite
  runMigrations(opened.db)
  cloud = await buildApp({
    config: loadConfig({ FRONTEND_DIR: '', MODE: 'cloud', SYNC_TOKENS: `venue-a=${TOKEN_A},venue-b=${TOKEN_B}` }),
    sqlite: opened.sqlite,
    db: opened.db,
    hub: cloudHub,
    liveBoardMs: 0,
  })
  await cloud.listen({ port: listenOn, host: '127.0.0.1' })
  port = (cloud.server.address() as { port: number }).port
}

async function startVenue(overrides: Record<string, string> = {}) {
  venueHub = silentHub()
  const opened = openDatabase(join(dir, 'venue.db'))
  venueSqlite = opened.sqlite
  runMigrations(opened.db)
  venue = await buildApp({ config: venueConfig(overrides), sqlite: opened.sqlite, db: opened.db, hub: venueHub, liveBoardMs: 0 })
}

let cloudAdmin = ''
let venueAdmin = ''
let venueSecretariat = ''
let venueScrutineer = ''

const count = (s: Sqlite, sql: string, ...args: unknown[]) => (s.prepare(sql).get(...args) as { n: number }).n
const rows = (s: Sqlite, sql: string, ...args: unknown[]) => s.prepare(sql).all(...args)

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'bis-sync-'))
  // The cloud starts as a sample competition that has not been run yet: no rounds, results or rankings for it
  {
    const { db, sqlite } = openDatabase(join(dir, 'cloud.db'))
    runMigrations(db)
    seedSampleData(db)
    sqlite.prepare('delete from rounds where event_id in (select id from events where competition_id = ?)').run(COMP)
    sqlite.prepare('delete from results where event_id in (select id from events where competition_id = ?)').run(COMP)
    sqlite.prepare('delete from ranking_points where competition_id = ?').run(COMP)
    sqlite.close()
  }
  await startCloud()
  await startVenue()
  for (const [id, name, username, role] of [
    ['v-admin', 'Venue Admin', 'admin', 'admin'],
    ['v-sec', 'Venue Secretariat', 'secretariat', 'secretariat'],
    ['v-scr', 'Venue Scrutineer', 'scrutineer', 'scrutineer'],
    ['v-chair', 'Venue Chair', 'chairperson', 'chairperson'],
  ] as const) {
    venueSqlite.prepare('insert into staff_users (id, name, username, role, password_hash, disabled) values (?, ?, ?, ?, ?, 0)').run(id, name, username, role, hashPassword('pw-' + username))
  }
  cloudAdmin = await staff(cloud, 'admin', SAMPLE_PASSWORD)
  venueAdmin = await staff(venue, 'admin', 'pw-admin')
  venueSecretariat = await staff(venue, 'secretariat', 'pw-secretariat')
  venueScrutineer = await staff(venue, 'scrutineer', 'pw-scrutineer')
})
afterAll(async () => {
  await venue.close().catch(() => {})
  venueSqlite.close()
  await cloud.close().catch(() => {})
  cloudSqlite.close()
  rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
})

describe('before anything is downloaded', () => {
  it('starts with nothing to send', async () => {
    const status = await ok<SyncStatus>(venue, 'getSyncStatus', [], venueScrutineer)
    expect(status).toMatchObject({ enabled: true, venueId: 'venue-a', pending: 0, held: [], lastUploadAt: null })
  })

  it('shows the competitions on the cloud to the people who may download', async () => {
    const list = await ok<CloudCompetition[]>(venue, 'getCloudCompetitions', [], venueSecretariat)
    expect(list.map((c) => c.id)).toContain(COMP)
    expect(list.find((c) => c.id === COMP)).toMatchObject({ heldBy: null, name: 'Sorsogon Dancesport Open 2026' })
    expect((await call(venue, 'getCloudCompetitions', [], venueScrutineer)).status).toBe(403)
    expect((await call(venue, 'getCloudCompetitions')).status).toBe(401)
  })

  it('is refused by the cloud for a wrong secret, without signing anyone out', async () => {
    const opened = openDatabase(':memory:')
    runMigrations(opened.db)
    opened.sqlite.prepare('insert into staff_users (id, name, username, role, password_hash, disabled) values (?, ?, ?, ?, ?, 0)').run('x', 'X', 'admin', 'admin', hashPassword('pw'))
    const stranger = await buildApp({ config: venueConfig({ SYNC_TOKEN: 'a-completely-wrong-secret' }), sqlite: opened.sqlite, db: opened.db, hub: silentHub(), liveBoardMs: 0 })
    const cookie = await staff(stranger, 'admin', 'pw')
    const reply = await call(stranger, 'getCloudCompetitions', [], cookie)
    // 502, not 401: a 401 would tell the screen the person's own sign-in had ended
    expect(reply).toMatchObject({ status: 502 })
    expect(reply.error).toMatch(/did not accept this laptop/)
    await stranger.close()
    opened.sqlite.close()
  })

  it('has no download or sync functions online, and no PIN sign-in', async () => {
    expect((await call(cloud, 'startRound', ['x'], cloudAdmin)).status).toBe(404)
    expect((await call(cloud, 'getSyncStatus', [], cloudAdmin)).status).toBe(404)
    expect((await call(cloud, 'pullCompetition', [COMP], cloudAdmin)).status).toBe(404)
    expect((await cloud.inject({ method: 'POST', url: '/api/auth/adjudicator', payload: { pin: '4100' } })).statusCode).toBe(404)
  })
})

describe('downloading the competition', () => {
  let summary: PullSummary

  it('brings the paid entries, panels and pins, and says how many are not paid', async () => {
    summary = await ok<PullSummary>(venue, 'pullCompetition', [COMP], venueSecretariat)
    expect(summary.competitionId).toBe(COMP)
    expect(summary.excludedEntries).toBeGreaterThan(0)
    expect(summary.added.entries).toBeGreaterThan(100)
    expect(count(venueSqlite, 'select count(*) as n from entries')).toBe(summary.added.entries)
    expect(count(venueSqlite, 'select count(*) as n from adjudicator_pins where competition_id = ?', COMP)).toBe(9)
    expect(count(venueSqlite, 'select count(*) as n from panels')).toBeGreaterThan(50)
    expect(venueSqlite.pragma('foreign_key_check')).toEqual([])
    // Only paid entries: none waits on a payment that is not settled
    expect(
      count(venueSqlite, "select count(*) as n from entries e join payments p on p.id = e.payment_id where p.status in ('unpaid', 'for_checking', 'rejected')"),
    ).toBe(0)
  })

  it('records it was downloaded, and starts queueing changes', async () => {
    const status = await ok<SyncStatus>(venue, 'getSyncStatus', [], venueScrutineer)
    expect(status.held).toEqual([COMP])
    // Only the note in the audit trail that it was downloaded
    expect(rows(venueSqlite, 'select entity from outbox')).toEqual([{ entity: 'audit_log' }])
    venueSqlite.prepare('delete from outbox').run()
    venueSqlite.prepare('update competitors set back_number = back_number where id = (select id from competitors limit 1)').run()
    expect(count(venueSqlite, 'select count(*) as n from outbox')).toBeGreaterThan(0)
    venueSqlite.prepare('delete from outbox').run()
    expect(count(venueSqlite, "select count(*) as n from audit_log where action = 'Downloaded a competition from the cloud'")).toBe(1)
  })

  it('holds the competition on the cloud: entries and payments close online, everything else carries on', async () => {
    const online = await ok<{ heldBy: string }>(cloud, 'getCompetition', [COMP])
    expect(online.heldBy).toBe('venue-a')
    const club = await ok<Array<{ contactEmail: string }>>(cloud, 'getClubs', [], cloudAdmin)
    const clubCookie = await signIn(cloud, '/api/auth/club', { email: club[0]!.contactEmail, password: SAMPLE_PASSWORD })
    const dancers = await ok<Array<{ id: string }>>(cloud, 'getClubDancers', [], clubCookie)
    const refused = await call(cloud, 'registerClubEntries', [dancers[0]!.id, []], clubCookie)
    expect(refused.status).toBe(409)
    expect(refused.error).toMatch(/being run at venue-a/)
    const payment = cloudSqlite.prepare("select id from payments where status = 'for_checking' limit 1").get() as { id: string }
    expect((await call(cloud, 'approvePayment', [payment.id], cloudAdmin)).error).toMatch(/being run at venue-a/)
    // Reading is never closed
    expect((await call(cloud, 'getEvents', [COMP])).status).toBe(200)
  })

  it('will not give the same competition to a second venue', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/sync/pull`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN_B}`, 'x-venue-id': 'venue-b' },
      body: JSON.stringify({ competitionId: COMP }),
    })
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toMatch(/already being run by venue-a/)
  })

  it('refreshes safely: nothing the venue did is overwritten, and a repeat adds nothing', async () => {
    const competitor = venueSqlite.prepare('select id from competitors where back_number is not null limit 1').get() as { id: string }
    venueSqlite.prepare('update competitors set back_number = 9001 where id = ?').run(competitor.id)
    const queued = count(venueSqlite, 'select count(*) as n from outbox')
    const again = await ok<PullSummary>(venue, 'pullCompetition', [COMP], venueSecretariat)
    expect(again.added.entries).toBe(0)
    expect(venueSqlite.prepare('select back_number as b from competitors where id = ?').get(competitor.id)).toEqual({ b: 9001 })
    // Only the audit note was added; the download queued no rows of the competition
    expect(count(venueSqlite, 'select count(*) as n from outbox')).toBe(queued + 1)
  })

  it('needs the right role, and says so when the cloud does not know the competition', async () => {
    expect((await call(venue, 'pullCompetition', [COMP], venueScrutineer)).status).toBe(403)
    expect((await call(venue, 'pullCompetition', [''], venueSecretariat)).status).toBe(400)
    expect((await call(venue, 'pullCompetition', ['not-a-competition'], venueSecretariat)).status).toBe(409)
  })
})

describe('running an event at the venue and sending it to the cloud', () => {
  let eventId = ''
  let rounds: RoundRow[] = []
  const phones: string[] = []

  // Everyone marks the same dancers, so nothing ties: the lowest back numbers go through, and finish in that order
  async function markRound(roundId: string) {
    for (let i = 0; i < phones.length; i++) {
      const state = await ok<{ status: string; task: { recallNumber: number | null; dances: string[]; competitors: Array<{ id: string; backNumber: number | null }> } }>(venue, 'getAdjudicatorState', [], phones[i])
      expect(state.status).toBe('marking')
      const ordered = [...state.task.competitors].sort((a, b) => (a.backNumber ?? 0) - (b.backNumber ?? 0)).map((c) => c.id)
      const chosen = state.task.recallNumber === null ? ordered : ordered.slice(0, state.task.recallNumber)
      const marks: MarkSubmission[] = state.task.dances.map((dance) => ({ dance: dance as MarkSubmission['dance'], competitorIds: chosen }))
      await ok(venue, 'submitAdjudicatorMarks', [roundId, marks], phones[i])
    }
  }

  it('plans the rounds, then runs an event from the first round to the final', async () => {
    // A solo event of 8 to 14 paid dancers: a semi-final and a final
    const candidates = venueSqlite
      .prepare('select e.event_id as id, count(*) as n from entries e join events ev on ev.id = e.event_id where ev.is_solo = 1 and ev.competition_id = ? group by e.event_id')
      .all(COMP) as Array<{ id: string; n: number }>
    eventId = candidates.find((c) => c.n >= 8 && c.n <= 14)!.id
    expect(await ok<number>(venue, 'planRounds', [COMP], venueScrutineer)).toBeGreaterThan(50)
    rounds = (await ok<RoundRow[]>(venue, 'getCompetitionRounds', [COMP], venueScrutineer)).filter((r) => r.eventId === eventId)
    expect(rounds.map((r) => r.type)).toEqual(['semi_final', 'final'])

    const pins = venueSqlite.prepare('select adjudicator_id as a, pin from adjudicator_pins where competition_id = ?').all(COMP) as Array<{ a: string; pin: string }>
    const panel = (venueSqlite.prepare('select m.adjudicator_id as a from panel_members m join panels p on p.id = m.panel_id where p.event_id = ?').all(eventId) as Array<{ a: string }>).map((r) => r.a)
    for (const adjudicator of panel) phones.push(await signIn(venue, '/api/auth/adjudicator', { pin: pins.find((p) => p.a === adjudicator)!.pin }))
    expect(phones.length).toBe(7)

    for (const round of rounds) {
      await ok(venue, 'startRound', [round.roundId], venueScrutineer)
      await markRound(round.roundId)
      await ok(venue, 'approveRound', [round.roundId], venueScrutineer)
      await ok(venue, 'publishRound', [round.roundId], venueScrutineer)
    }
    expect(count(venueSqlite, 'select count(*) as n from results where event_id = ?', eventId)).toBeGreaterThan(8)
  })

  it('has queued all of it, and the cloud has none of it yet', async () => {
    const status = await ok<SyncStatus>(venue, 'getSyncStatus', [], venueScrutineer)
    expect(status.pending).toBeGreaterThan(50)
    expect(count(cloudSqlite, 'select count(*) as n from rounds where event_id = ?', eventId)).toBe(0)
    expect(count(cloudSqlite, 'select count(*) as n from results where event_id = ?', eventId)).toBe(0)
    expect(await ok(cloud, 'getResults', [eventId])).toEqual([])
  })

  it('sends it, and the cloud ends up identical', async () => {
    const before = await ok<SyncStatus>(venue, 'getSyncStatus', [], venueScrutineer)
    const after = await ok<SyncStatus>(venue, 'syncNow', [], venueScrutineer)
    expect(after).toMatchObject({ pending: 0, failing: 0, lastError: null, reachable: true })
    expect(after.lastUploadAt).not.toBeNull()
    expect(before.pending).toBeGreaterThan(0)

    // Every table of the event matches row for row
    const same = (sql: string, ...args: unknown[]) => expect(rows(cloudSqlite, sql, ...args)).toEqual(rows(venueSqlite, sql, ...args))
    same('select * from rounds where event_id = ? order by id', eventId)
    same('select * from results where event_id = ? order by id', eventId)
    same('select * from ranking_points where event_id = ? order by id', eventId)
    same('select * from marks where round_id in (select id from rounds where event_id = ?) order by id', eventId)
    same('select * from submissions where round_id in (select id from rounds where event_id = ?) order by round_id, adjudicator_id', eventId)
    same('select * from heats where round_id in (select id from rounds where event_id = ?) order by id', eventId)
    same('select * from heat_competitors where heat_id in (select id from heats where round_id in (select id from rounds where event_id = ?)) order by heat_id, competitor_id', eventId)
    // Planning created every event's rounds; all of them arrived
    expect(count(cloudSqlite, 'select count(*) as n from rounds')).toBe(count(venueSqlite, 'select count(*) as n from rounds'))
    // What the venue changed on its own (the back number it set earlier) arrived too
    same('select id, back_number from competitors where back_number = 9001')
  })

  it('shows the public the results and rankings online, and tells watching spectators', async () => {
    const results = await ok<Array<{ place: number }>>(cloud, 'getResults', [eventId])
    expect(results.length).toBeGreaterThan(8)
    expect(results.filter((r) => r.place === 1)).toHaveLength(1)
    const rankings = await ok<Array<{ competitorId: string }>>(cloud, 'getRankingPoints', [{}])
    expect(rankings.length).toBeGreaterThan(900)
    expect(cloudHub.sent.some((m) => m.event === 'published')).toBe(true)
    expect(cloudHub.sent.some((m) => m.event === 'rankings')).toBe(true)
    // The audit trail of what happened at the venue is kept online too
    expect(count(cloudSqlite, "select count(*) as n from audit_log where action = 'Approved round'")).toBe(2)
  })

  it('does nothing when sent again, even the whole competition at once', async () => {
    const beforeMarks = count(cloudSqlite, 'select count(*) as n from marks')
    const beforeResults = count(cloudSqlite, 'select count(*) as n from results')
    const status = await ok<SyncStatus>(venue, 'uploadCompetition', [COMP], venueAdmin)
    expect(status.pending).toBe(0)
    expect(count(cloudSqlite, 'select count(*) as n from marks')).toBe(beforeMarks)
    expect(count(cloudSqlite, 'select count(*) as n from results')).toBe(beforeResults)
    expect(venueSqlite.pragma('foreign_key_check')).toEqual([])
  })

  it('sends changes within moments of making them, without being asked', async () => {
    const competitor = venueSqlite.prepare('select id from competitors where back_number = 9001').get() as { id: string }
    await ok(venue, 'setBackNumber', [competitor.id, 9100], venueSecretariat)
    const stamp = () => cloudSqlite.prepare('select back_number as b from competitors where id = ?').get(competitor.id) as { b: number }
    const end = Date.now() + 8000
    while (Date.now() < end && stamp().b !== 9100) await new Promise((r) => setTimeout(r, 100))
    expect(stamp().b).toBe(9100)
  })
})

describe('when the cloud cannot be reached', () => {
  it('keeps changes safe at the venue and sends them when it is back, once each', async () => {
    const competitor = venueSqlite.prepare('select id from competitors where back_number = 9100').get() as { id: string }
    await cloud.close()
    cloudSqlite.close()

    // The venue carries on: nothing about running the competition needs the cloud
    await ok(venue, 'setBackNumber', [competitor.id, 9200], venueSecretariat)
    // Trying to send answers with the state of things, including why it did not go
    const down = await ok<SyncStatus>(venue, 'syncNow', [], venueScrutineer)
    expect(down).toMatchObject({ reachable: false })
    expect(down.pending).toBeGreaterThan(0)
    expect(down.failing).toBeGreaterThan(0)
    expect(down.lastError).toMatch(/cannot be reached/)

    // The cloud comes back (restarted, on the same address and database)
    await startCloud(port)
    cloudAdmin = await staff(cloud, 'admin', SAMPLE_PASSWORD)
    const up = await ok<SyncStatus>(venue, 'syncNow', [], venueScrutineer)
    expect(up).toMatchObject({ pending: 0, lastError: null, reachable: true })
    expect(cloudSqlite.prepare('select back_number as b from competitors where id = ?').get(competitor.id)).toEqual({ b: 9200 })
  })
})

describe('what the cloud will not accept', () => {
  const post = (path: string, body: unknown, headers: Record<string, string> = { authorization: `Bearer ${TOKEN_A}`, 'x-venue-id': 'venue-a' }) =>
    fetch(`http://127.0.0.1:${port}/api/sync/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })

  it('turns away a venue that is unknown, has the wrong secret, or sends none', async () => {
    expect((await post('ping', {}, {})).status).toBe(401)
    expect((await post('ping', {}, { authorization: `Bearer ${TOKEN_A}`, 'x-venue-id': 'venue-z' })).status).toBe(401)
    expect((await post('ping', {}, { authorization: `Bearer ${TOKEN_B}`, 'x-venue-id': 'venue-a' })).status).toBe(401)
    expect((await post('ping', {}, { authorization: `Bearer ${TOKEN_A}`, 'x-venue-id': 'venue-a' })).status).toBe(200)
  })

  it('refuses unknown tables, other venues\' competitions, and oversized batches', async () => {
    const unknown = await post('upload', { items: [{ entity: 'staff_users', operation: 'upsert', payload: { id: 'x' } }] })
    expect(unknown.status).toBe(422)
    const other = await post('upload', {
      items: [{ entity: 'events', operation: 'upsert', payload: { id: 'ev-x', competition_id: 'comp-legazpi-2026', number: 1, position: 1, age_group: 'adult', class: 'A', discipline: 'latin', dances: '["samba"]', is_solo: 1 } }],
    })
    expect(other.status).toBe(409)
    expect(((await other.json()) as { error: string }).error).toMatch(/does not hold/)
    const big = await post('upload', { items: Array.from({ length: 1001 }, () => ({ entity: 'results', operation: 'delete', payload: { id: 'x' } })) })
    expect(big.status).toBe(400)
  })

  it('has no sync routes at all when no venue is allowed to sync', async () => {
    const opened = openDatabase(':memory:')
    runMigrations(opened.db)
    const plain = await buildApp({ config: loadConfig({ FRONTEND_DIR: '', MODE: 'cloud' }), sqlite: opened.sqlite, db: opened.db, hub: silentHub(), liveBoardMs: 0 })
    expect((await plain.inject({ method: 'POST', url: '/api/sync/ping', payload: {} })).statusCode).toBe(404)
    await plain.close()
    opened.sqlite.close()
  })
})

describe('finishing', () => {
  it('will not release a competition while changes are waiting', async () => {
    const competitor = venueSqlite.prepare('select id from competitors where back_number = 9200').get() as { id: string }
    venueSqlite.prepare('update competitors set back_number = 9300 where id = ?').run(competitor.id)
    const refused = await call(venue, 'releaseCompetition', [COMP], venueAdmin)
    expect(refused.status).toBe(409)
    expect(refused.error).toMatch(/not reached the cloud/)
    expect(await call(venue, 'releaseCompetition', [COMP], venueScrutineer)).toMatchObject({ status: 403 })
  })

  it('releases it once everything is sent, and entries can change online again', async () => {
    await ok(venue, 'syncNow', [], venueScrutineer)
    await ok(venue, 'releaseCompetition', [COMP], venueAdmin)
    expect(((await ok<{ heldBy: string | null }>(cloud, 'getCompetition', [COMP])).heldBy)).toBeNull()
    expect((await ok<SyncStatus>(venue, 'getSyncStatus', [], venueScrutineer)).held).toEqual([])

    const club = await ok<Array<{ contactEmail: string }>>(cloud, 'getClubs', [], cloudAdmin)
    const clubCookie = await signIn(cloud, '/api/auth/club', { email: club[0]!.contactEmail, password: SAMPLE_PASSWORD })
    const dancers = await ok<Array<{ id: string }>>(cloud, 'getClubDancers', [], clubCookie)
    const reply = await call(cloud, 'registerClubEntries', [dancers[0]!.id, []], clubCookie)
    expect(reply.error ?? '').not.toMatch(/being run at/)
  })

  it('lets an online admin take a competition back from a venue that is gone', async () => {
    // Another venue takes it, then is lost
    await fetch(`http://127.0.0.1:${port}/api/sync/pull`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN_B}`, 'x-venue-id': 'venue-b' },
      body: JSON.stringify({ competitionId: COMP }),
    })
    expect((await ok<{ heldBy: string }>(cloud, 'getCompetition', [COMP])).heldBy).toBe('venue-b')
    const staffCookie = await staff(cloud, 'secretariat', SAMPLE_PASSWORD)
    expect((await call(cloud, 'unlockCompetition', [COMP], staffCookie)).status).toBe(403)
    await ok(cloud, 'unlockCompetition', [COMP], cloudAdmin)
    expect((await ok<{ heldBy: string | null }>(cloud, 'getCompetition', [COMP])).heldBy).toBeNull()
    expect((await call(cloud, 'unlockCompetition', [COMP], cloudAdmin)).error).toMatch(/Nobody is running/)
  })
})

describe('a venue that is restarted or restored', () => {
  it('keeps queueing, and remembers what it has downloaded', async () => {
    // Download again so the venue holds a competition, then stop and start the venue on the same database
    await ok(venue, 'pullCompetition', [COMP], venueSecretariat)
    await venue.close()
    venueSqlite.close()
    await startVenue()
    venueSecretariat = await staff(venue, 'secretariat', 'pw-secretariat')
    venueScrutineer = await staff(venue, 'scrutineer', 'pw-scrutineer')

    expect((await ok<SyncStatus>(venue, 'getSyncStatus', [], venueScrutineer)).held).toEqual([COMP])
    const competitor = venueSqlite.prepare('select id from competitors limit 1').get() as { id: string }
    const before = count(venueSqlite, 'select count(*) as n from outbox where sent_at is null')
    await ok(venue, 'setBackNumber', [competitor.id, 9400], venueSecretariat)
    expect(count(venueSqlite, 'select count(*) as n from outbox where sent_at is null')).toBeGreaterThan(before)
  })

  it('does not queue anything when it has no cloud address, so the outbox cannot grow for nothing', async () => {
    const opened = openDatabase(':memory:')
    runMigrations(opened.db)
    seedSampleData(opened.db)
    const alone = await buildApp({ config: loadConfig({ FRONTEND_DIR: '' }), sqlite: opened.sqlite, db: opened.db, hub: silentHub(), liveBoardMs: 0 })
    const admin = await staff(alone, 'admin', SAMPLE_PASSWORD)
    await ok(alone, 'assignBackNumbers', [], admin)
    expect(count(opened.sqlite, 'select count(*) as n from outbox')).toBe(0)
    const status = await ok<SyncStatus>(alone, 'getSyncStatus', [], admin)
    expect(status).toMatchObject({ enabled: false, pending: 0 })
    expect((await call(alone, 'pullCompetition', [COMP], admin)).error).toMatch(/not set up to talk to the cloud/)
    await alone.close()
    opened.sqlite.close()
  })
})

