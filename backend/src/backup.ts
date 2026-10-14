import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import type { BackupStatus } from '@bis/shared'
import type { Sqlite } from './db/client.ts'
import { now } from './ids.ts'

export interface Backups {
  // Copies the database to every target; one missing target does not stop the others
  run(): Promise<BackupStatus>
  status(): BackupStatus
  start(): void
  stop(): void
}

const KEEP = 30

const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')

function prune(dir: string) {
  const files = readdirSync(dir)
    .filter((f) => /^bis-.*\.db$/.test(f))
    .map((f) => ({ f, at: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.at - a.at)
  for (const old of files.slice(KEEP)) unlinkSync(join(dir, old.f))
}

// Uses SQLite's own online backup, so a copy taken while marks are being saved is still consistent
export function createBackups(sqlite: Sqlite, dirs: string[], intervalMinutes: number): Backups {
  const targets: BackupStatus['targets'] = dirs.map((path) => ({ path, ok: true, lastBackupAt: null, error: null }))
  let timer: ReturnType<typeof setInterval> | undefined
  let running: Promise<BackupStatus> | undefined

  const status = (): BackupStatus => ({
    targets: targets.map((t) => ({ ...t })),
    lastBackupAt: targets.map((t) => t.lastBackupAt).filter((a): a is string => a !== null).sort().at(-1) ?? null,
  })

  async function copy() {
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
    return status()
  }

  return {
    run() {
      // Backups requested while one is running share it
      running ??= copy().finally(() => {
        running = undefined
      })
      return running
    },
    status,
    start() {
      if (intervalMinutes > 0 && !timer) {
        timer = setInterval(() => void this.run(), intervalMinutes * 60_000)
        timer.unref()
      }
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = undefined
    },
  }
}

export const noBackups = (): Backups => ({
  run: async () => ({ targets: [], lastBackupAt: null }),
  status: () => ({ targets: [], lastBackupAt: null }),
  start: () => {},
  stop: () => {},
})
