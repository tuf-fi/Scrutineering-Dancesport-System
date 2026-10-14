import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import * as schema from './schema.ts'

export function openDatabase(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const sqlite = new Database(path)
  // WAL lets every screen read while marks are being saved
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('busy_timeout = 5000')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('synchronous = NORMAL')
  return { sqlite, db: drizzle(sqlite, { schema }) }
}

export type Db = ReturnType<typeof openDatabase>['db']
export type Sqlite = ReturnType<typeof openDatabase>['sqlite']
