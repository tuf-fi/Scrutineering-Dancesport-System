import type { CloudCompetition, PullSummary, SyncStatus } from '@bis/shared'
import type { Config } from '../config.ts'
import type { Sqlite } from '../db/client.ts'
import { now } from '../ids.ts'
import type { Hub } from '../realtime/hub.ts'
import { applySnapshot, type SyncItem, type SyncSnapshot } from './apply.ts'
import { setCapture } from './capture.ts'
import { UPLOAD_TABLES } from './tables.ts'
import { jsonObjectSql } from './triggers.ts'

// The venue's half of syncing: download a competition before the event, and send every change back as it happens.
// Nothing here is needed to run the competition. If the cloud cannot be reached, changes wait in the outbox, safe in
// the database, and go when it can.

export class SyncError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'SyncError'
    this.status = status
  }
}

export interface SyncService {
  enabled: boolean
  status(): SyncStatus
  cloudCompetitions(): Promise<CloudCompetition[]>
  pull(competitionId: string): Promise<PullSummary>
  // Sends everything waiting; returns the status afterwards
  uploadNow(): Promise<SyncStatus>
  // Queues every row of a competition again, for when changes were not being captured or something went wrong
  queueAll(competitionId: string): number
  release(competitionId: string): Promise<void>
  // Upload a moment after a change
  soon(): void
  start(): void
  stop(): void
}

const BATCH = 200
const REQUEST_MS = 30_000
const LOOP_MS = 20_000
const KEEP_SENT_MS = 3 * 24 * 3_600_000

const setting = (sqlite: Sqlite, key: string): string | null =>
  (sqlite.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined)?.value ?? null
const saveSetting = (sqlite: Sqlite, key: string, value: string) =>
  void sqlite.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(key, value)

// Which rows belong to a competition, for queueing them all again
const IN_EVENTS = '(SELECT id FROM events WHERE competition_id = @c)'
const IN_ROUNDS = `(SELECT id FROM rounds WHERE event_id IN ${IN_EVENTS})`
const SCOPE: Record<string, string> = {
  events: 'competition_id = @c',
  competitors: `id IN (SELECT competitor_id FROM entries WHERE event_id IN ${IN_EVENTS})`,
  payments: `id IN (SELECT payment_id FROM entries WHERE payment_id IS NOT NULL AND event_id IN ${IN_EVENTS})`,
  entries: `event_id IN ${IN_EVENTS}`,
  rounds: `event_id IN ${IN_EVENTS}`,
  heats: `round_id IN ${IN_ROUNDS}`,
  heat_competitors: `heat_id IN (SELECT id FROM heats WHERE round_id IN ${IN_ROUNDS})`,
  submissions: `round_id IN ${IN_ROUNDS}`,
  marks: `round_id IN ${IN_ROUNDS}`,
  tie_decisions: `round_id IN ${IN_ROUNDS}`,
  results: `event_id IN ${IN_EVENTS}`,
  ranking_points: 'competition_id = @c',
}

interface Deps {
  config: Config
  sqlite: Sqlite
  hub: Hub
}

export function createSyncService({ config, sqlite, hub }: Deps): SyncService {
  const enabled = Boolean(config.cloudUrl && config.syncToken)
  let lastError: string | null = null
  let reachable: boolean | null = null
  let sending: Promise<SyncStatus> | undefined
  let loop: ReturnType<typeof setInterval> | undefined
  let soonTimer: ReturnType<typeof setTimeout> | undefined
  let soonDue = 0

  async function cloud<T>(path: string, body: unknown): Promise<T> {
    if (!enabled) throw new SyncError(503, 'This laptop is not set up to talk to the cloud.')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_MS)
    let res: Response
    try {
      res = await fetch(`${config.cloudUrl}/api/sync/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${config.syncToken}`, 'x-venue-id': config.venueId },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch {
      reachable = false
      throw new SyncError(0, 'The cloud cannot be reached. Changes are kept here and will be sent when it can.')
    } finally {
      clearTimeout(timer)
    }
    reachable = true
    const payload = (await res.json().catch(() => ({}))) as { data?: T; error?: string }
    if (!res.ok) throw new SyncError(res.status, payload.error ?? `The cloud answered ${res.status}.`)
    return payload.data as T
  }

  const held = (): string[] => JSON.parse(setting(sqlite, 'sync_held') ?? '[]') as string[]
  const pendingCount = () => (sqlite.prepare('SELECT count(*) AS n FROM outbox WHERE sent_at IS NULL').get() as { n: number }).n

  const status = (): SyncStatus => ({
    enabled,
    venueId: config.venueId,
    cloudUrl: config.cloudUrl,
    pending: pendingCount(),
    failing: (sqlite.prepare('SELECT count(*) AS n FROM outbox WHERE sent_at IS NULL AND attempts > 0').get() as { n: number }).n,
    lastUploadAt: setting(sqlite, 'sync_last_upload_at'),
    lastError,
    reachable,
    held: held(),
  })

  async function sendAll(): Promise<SyncStatus> {
    if (!enabled) return status()
    // Sending now makes a send that was waiting for its moment unnecessary
    if (soonTimer) clearTimeout(soonTimer)
    soonTimer = undefined
    for (;;) {
      const rows = sqlite
        .prepare('SELECT rowid AS seq, id, entity, operation, payload FROM outbox WHERE sent_at IS NULL ORDER BY rowid LIMIT ?')
        .all(BATCH) as Array<{ seq: number; id: string; entity: string; operation: 'upsert' | 'delete'; payload: string }>
      if (rows.length === 0) break
      const items: SyncItem[] = rows.map((r) => ({ entity: r.entity, operation: r.operation, payload: JSON.parse(r.payload) }))
      try {
        await cloud('upload', { items })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        lastError = message
        sqlite.prepare('UPDATE outbox SET attempts = attempts + 1 WHERE rowid IN (' + rows.map(() => '?').join(', ') + ')').run(...rows.map((r) => r.seq))
        break
      }
      const stamp = now()
      sqlite.prepare('UPDATE outbox SET sent_at = ? WHERE rowid IN (' + rows.map(() => '?').join(', ') + ')').run(stamp, ...rows.map((r) => r.seq))
      saveSetting(sqlite, 'sync_last_upload_at', stamp)
      lastError = null
    }
    sqlite.prepare('DELETE FROM outbox WHERE sent_at IS NOT NULL AND sent_at < ?').run(new Date(Date.now() - KEEP_SENT_MS).toISOString())
    hub.changed('sync')
    return status()
  }

  const service: SyncService = {
    enabled,
    status,

    cloudCompetitions: () => cloud<CloudCompetition[]>('competitions', {}),

    async pull(competitionId) {
      const snapshot = await cloud<SyncSnapshot>('pull', { competitionId })
      const { added } = applySnapshot(sqlite, snapshot)
      // From now on every change here is queued for the cloud
      setCapture(sqlite, true)
      const list = new Set(held())
      list.add(competitionId)
      saveSetting(sqlite, 'sync_held', JSON.stringify([...list]))
      return { competitionId, added, excludedEntries: snapshot.excluded.entries }
    },

    uploadNow() {
      // A request made while one is running shares it
      sending ??= sendAll().finally(() => {
        sending = undefined
      })
      return sending
    },

    queueAll(competitionId) {
      let queued = 0
      sqlite.transaction(() => {
        for (const table of UPLOAD_TABLES) {
          const scope = SCOPE[table.name]
          if (!scope) continue
          const key = table.primaryKey.map((c) => `"${c}"`).join(` || ':' || `)
          const info = sqlite
            .prepare(
              `INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
               SELECT lower(hex(randomblob(16))), '${table.name}', ${key}, 'upsert', ${jsonObjectSql(table, '')}, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
               FROM "${table.name}" WHERE ${scope}`,
            )
            .run({ c: competitionId })
          queued += info.changes
        }
      })()
      return queued
    },

    async release(competitionId) {
      if (pendingCount() > 0) throw new SyncError(409, 'Some changes have not reached the cloud yet. Send them first.')
      await cloud('release', { competitionId })
      saveSetting(sqlite, 'sync_held', JSON.stringify(held().filter((id) => id !== competitionId)))
    },

    soon() {
      if (!enabled) return
      // A send already due sooner than this one stays; a later one is brought forward
      const due = Date.now() + config.syncDelayMs
      if (soonTimer && soonDue <= due) return
      if (soonTimer) clearTimeout(soonTimer)
      soonDue = due
      soonTimer = setTimeout(() => {
        soonTimer = undefined
        void service.uploadNow()
      }, config.syncDelayMs)
      soonTimer.unref()
    },

    start() {
      if (!enabled || loop) return
      // Changes made while the program was stopped, or while the cloud could not be reached
      loop = setInterval(() => void service.uploadNow(), LOOP_MS)
      loop.unref()
      void service.uploadNow()
    },

    stop() {
      if (loop) clearInterval(loop)
      if (soonTimer) clearTimeout(soonTimer)
      loop = undefined
      soonTimer = undefined
    },
  }
  return service
}
