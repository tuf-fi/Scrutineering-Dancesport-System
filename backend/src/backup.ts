import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import type { BackupStatus } from '@bis/shared'
import type { Sqlite } from './db/client.ts'
import { now } from './ids.ts'

export interface Backups {
  // Copies the database to every target; one missing target does not stop the others
  run(): Promise<BackupStatus>
  // Copy again in a moment: after any change, so a laptop that dies loses at most the last second or two of work.
  // Changes that arrive together share one copy.
  soon(): void
  status(): BackupStatus
  // Told when a folder starts or stops working, so the screens can say so at once instead of on their next check
  onChange(listener: () => void): void
  start(): void
  stop(): void
}

// A copy is made soon after every change, so a busy minute makes many. These keep recent history dense and
// older history thin: the newest RECENT copies, plus the newest copy of every 10-minute slot for a day.
const RECENT = 60
const SLOT_MS = 10 * 60_000
const HISTORY_MS = 24 * 3_600_000
const SOON_MS = 1000
// Copies made because of changes are at least this far apart
const SOON_GAP_MS = 3000

const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')

// Which of these copies to keep; the rest can be deleted
export function copiesToKeep(files: Array<{ f: string; at: number }>, nowMs = Date.now()): Set<string> {
  const newestFirst = [...files].sort((a, b) => b.at - a.at)
  const keep = new Set(newestFirst.slice(0, RECENT).map((x) => x.f))
  const seenSlots = new Set<number>()
  for (const file of newestFirst) {
    if (nowMs - file.at > HISTORY_MS) break
    const slot = Math.floor(file.at / SLOT_MS)
    if (!seenSlots.has(slot)) {
      seenSlots.add(slot)
      keep.add(file.f)
    }
  }
  return keep
}

function prune(dir: string) {
  const files = readdirSync(dir)
    .filter((f) => /^bis-.*\.db$/.test(f))
    .map((f) => ({ f, at: statSync(join(dir, f)).mtimeMs }))
  const keep = copiesToKeep(files)
  for (const old of files) if (!keep.has(old.f)) unlinkSync(join(dir, old.f))
}

// Uses SQLite's own online backup, so a copy taken while marks are being saved is still consistent
export function createBackups(sqlite: Sqlite, dirs: string[], intervalMinutes: number): Backups {
  const targets: BackupStatus['targets'] = dirs.map((path) => ({ path, ok: true, lastBackupAt: null, error: null }))
  let timer: ReturnType<typeof setInterval> | undefined
  let pendingCopy: ReturnType<typeof setTimeout> | undefined
  let running: Promise<BackupStatus> | undefined

  const status = (): BackupStatus => ({
    targets: targets.map((t) => ({ ...t })),
    lastBackupAt: targets.map((t) => t.lastBackupAt).filter((a): a is string => a !== null).sort().at(-1) ?? null,
  })

  async function copy() {
    const before = targets.map((t) => t.ok).join()
    for (const target of targets) {
      try {
        mkdirSync(target.path, { recursive: true })
        await sqlite.backup(join(target.path, `bis-${stamp()}.db`))
        prune(target.path)
        target.ok = true
        target.error = null
        target.lastBackupAt = now()
      } catch (error) {
        target.ok = false
        target.error = error instanceof Error ? error.message : String(error)
      }
    }
    if (targets.map((t) => t.ok).join() !== before) listeners.forEach((listener) => listener())
    return status()
  }

  // Backups requested while one is running share it
  const listeners: Array<() => void> = []
  let lastRunAt = 0
  const run = () => {
    lastRunAt = Date.now()
    running ??= copy().finally(() => {
      running = undefined
    })
    return running
  }

  return {
    run,
    soon() {
      if (pendingCopy) return
      const wait = Math.max(SOON_MS, lastRunAt + SOON_GAP_MS - Date.now())
      pendingCopy = setTimeout(() => {
        pendingCopy = undefined
        void run()
      }, wait)
      pendingCopy.unref()
    },
    status,
    onChange: (listener) => void listeners.push(listener),
    start() {
      if (intervalMinutes > 0 && !timer) {
        timer = setInterval(() => void this.run(), intervalMinutes * 60_000)
        timer.unref()
      }
    },
    stop() {
      if (timer) clearInterval(timer)
      if (pendingCopy) clearTimeout(pendingCopy)
      timer = undefined
      pendingCopy = undefined
    },
  }
}

export const noBackups = (): Backups => ({
  run: async () => ({ targets: [], lastBackupAt: null }),
  soon: () => {},
  status: () => ({ targets: [], lastBackupAt: null }),
  onChange: () => {},
  start: () => {},
  stop: () => {},
})
