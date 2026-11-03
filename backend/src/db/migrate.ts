import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { join } from 'node:path'
import { newId } from '../ids.ts'
import type { Db } from './client.ts'
import * as t from './schema.ts'

const migrationsFolder = join(import.meta.dirname, '..', '..', 'drizzle')

// The points table from the organizer's entry form (Bicol Grassroots); the admin can edit it
const DEFAULT_POINTS = [
  { place: 1, round: null, label: '1st', points: 200 },
  { place: 2, round: null, label: '2nd', points: 180 },
  { place: 3, round: null, label: '3rd', points: 160 },
  { place: 4, round: null, label: '4th', points: 140 },
  { place: 5, round: null, label: '5th', points: 120 },
  { place: 6, round: null, label: '6th', points: 100 },
  // TODO: the entry form stops at 6th; ask the organizer what a 7th place earns
  { place: 7, round: null, label: '7th (7-competitor final)', points: 0 },
  { place: null, round: 'semi_final' as const, label: 'Semi-final', points: 70 },
  { place: null, round: 'quarter_final' as const, label: 'Quarter-final', points: 50 },
]

// Creates the tables on a fresh database and applies any newer migrations on an existing one,
// then makes sure the points table exists
export function runMigrations(db: Db) {
  // A migration that rebuilds a table drops it while others point at it. SQLite ignores the PRAGMA inside the
  // migration's own transaction, so keys are turned off here, before it, and checked once it is done.
  db.run(sql`PRAGMA foreign_keys = OFF`)
  try {
    migrate(db, { migrationsFolder })
    if (db.all(sql`PRAGMA foreign_key_check`).length > 0) throw new Error('A migration left rows pointing at rows that do not exist')
  } finally {
    db.run(sql`PRAGMA foreign_keys = ON`)
  }
  if (db.select().from(t.pointsTable).limit(1).all().length === 0) {
    DEFAULT_POINTS.forEach((row, sortOrder) => db.insert(t.pointsTable).values({ id: newId(), ...row, sortOrder }).run())
  }
  // A table made before the quarter-final row existed gets one, worth nothing until the admin sets it
  const rows = db.select().from(t.pointsTable).all()
  if (!rows.some((r) => r.round === 'quarter_final')) {
    db.insert(t.pointsTable).values({ id: newId(), place: null, round: 'quarter_final', label: 'Quarter-final', points: 0, sortOrder: rows.length }).run()
  }
}
