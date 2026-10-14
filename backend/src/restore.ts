import Database from 'better-sqlite3'
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

// Putting a backup in place of the live database: used when Laptop 2 fails and Laptop 3 takes over,
// or to go back to an earlier state. Nothing that was there is ever deleted.

export interface BackupSummary {
  file: string
  // When the last recorded action in the backup happened; tells how much, if anything, is missing
  lastAction: string | null
  competitions: number
  events: number
  marks: number
  results: number
}

const isBackup = (name: string) => /^bis-.*\.db$/.test(name)

// The newest backup copy among these folders, or null when there is none
export function newestBackup(dirs: string[]): string | null {
  const copies = dirs.flatMap((dir) => {
    if (!existsSync(dir)) return []
    return readdirSync(dir)
      .filter(isBackup)
      .map((name) => ({ file: join(dir, name), at: statSync(join(dir, name)).mtimeMs }))
  })
  return copies.sort((a, b) => b.at - a.at)[0]?.file ?? null
}

// Opens a backup read-only and checks it is a whole, healthy BIS database
export function inspectBackup(file: string): BackupSummary {
  if (!existsSync(file)) throw new Error(`There is no file at ${file}.`)
  let db: Database.Database
  try {
    db = new Database(file, { readonly: true, fileMustExist: true })
  } catch {
    throw new Error(`${file} is not a database.`)
  }
  try {
    if (db.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('it is damaged')
    const count = (table: string) => (db.prepare(`select count(*) as n from ${table}`).get() as { n: number }).n
    const last = db.prepare('select max(at) as at from audit_log').get() as { at: string | null }
    return {
      file,
      lastAction: last.at,
      competitions: count('competitions'),
      events: count('events'),
      marks: count('marks'),
      results: count('results'),
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`${file} cannot be used: ${/no such table/.test(reason) ? 'it is not a BIS database' : reason}.`)
  } finally {
    db.close()
  }
}

const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')

export interface RestoreOptions {
  from: string
  to: string
  // The live database is moved aside, not deleted, and the backup takes its place
  replace?: boolean
}

export interface RestoreResult extends BackupSummary {
  // Where the database that was in the way now is, when it was replaced
  keptAs: string | null
}

export function restoreDatabase({ from, to, replace = false }: RestoreOptions): RestoreResult {
  const summary = inspectBackup(from)
  let keptAs: string | null = null

  if (existsSync(to)) {
    if (!replace) {
      throw new Error(`${to} already exists. Run again with --replace to move it aside and use the backup instead.`)
    }
    keptAs = `${to}.replaced-${stamp()}`
    renameSync(to, keptAs)
    // A leftover write-ahead log belongs to the old database and would corrupt the restored one
    for (const extra of ['-wal', '-shm']) if (existsSync(to + extra)) renameSync(to + extra, keptAs + extra)
  } else {
    for (const extra of ['-wal', '-shm']) if (existsSync(to + extra)) renameSync(to + extra, `${to}${extra}.replaced-${stamp()}`)
  }

  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
  // The copy must open and be whole, or the move did not work
  inspectBackup(to)
  return { ...summary, file: basename(from), keptAs }
}
