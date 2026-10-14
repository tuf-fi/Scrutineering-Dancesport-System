import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { join } from 'node:path'
import { newId } from '../ids.ts'
import type { Db } from './client.ts'
import * as t from './schema.ts'

const migrationsFolder = join(import.meta.dirname, '..', '..', 'drizzle')

// The starting points table from ROLES_README, until the client approves their own; the admin can edit it
export const DEFAULT_POINTS = [
  { place: 1, label: '1st', points: 10 },
  { place: 2, label: '2nd', points: 8 },
  { place: 3, label: '3rd', points: 6 },
  { place: 4, label: '4th', points: 5 },
  { place: 5, label: '5th', points: 4 },
  { place: 6, label: '6th', points: 3 },
  { place: 7, label: '7th (7-competitor final)', points: 2 },
  { place: null, label: 'Semi-final', points: 1 },
]

// Creates the tables on a fresh database and applies any newer migrations on an existing one,
// then makes sure the points table exists
export function runMigrations(db: Db) {
  migrate(db, { migrationsFolder })
  if (db.select().from(t.pointsTable).limit(1).all().length === 0) {
    DEFAULT_POINTS.forEach((row, sortOrder) => db.insert(t.pointsTable).values({ id: newId(), ...row, sortOrder }).run())
  }
}
