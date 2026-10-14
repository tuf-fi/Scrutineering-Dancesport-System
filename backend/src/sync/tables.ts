import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core'
import * as t from '../db/schema.ts'

// Which tables travel between the venue and the cloud, read from the database schema itself so the lists of columns
// and keys can never drift from it.
export interface SyncTable {
  name: string
  table: SQLiteTable
  // Columns that are sent
  columns: string[]
  primaryKey: string[]
}

function describe(table: SQLiteTable, skip: string[] = []): SyncTable {
  const config = getTableConfig(table)
  const composite = config.primaryKeys[0]?.columns.map((c) => c.name)
  return {
    name: config.name,
    table,
    columns: config.columns.map((c) => c.name).filter((name) => !skip.includes(name)),
    primaryKey: composite ?? config.columns.filter((c) => c.primary).map((c) => c.name),
  }
}

// Sent from the venue to the cloud, parents before children. This is everything that changes on the day.
// A payment's receipt picture is never sent back: the cloud already has it, and it is large.
export const UPLOAD_TABLES: SyncTable[] = [
  describe(t.events),
  describe(t.competitors),
  describe(t.payments, ['receipt']),
  describe(t.entries),
  describe(t.rounds),
  describe(t.heats),
  describe(t.heatCompetitors),
  describe(t.submissions),
  describe(t.marks),
  describe(t.tieDecisions),
  describe(t.results),
  describe(t.rankingPoints),
  describe(t.auditLog),
]

// Sent from the cloud to the venue when a competition is downloaded, parents before children. Passwords, receipts, and
// the venue's own state (the round on the floor, who holds the competition) are never sent.
export const DOWNLOAD_TABLES: SyncTable[] = [
  describe(t.competitions, ['floor_round_id', 'held_by', 'held_at']),
  describe(t.clubs, ['password_hash', 'consent_at']),
  describe(t.competitors),
  describe(t.events),
  describe(t.payments, ['receipt']),
  describe(t.entries),
  describe(t.adjudicators),
  describe(t.adjudicatorPins),
  describe(t.panels),
  describe(t.panelMembers),
  describe(t.pointsTable),
  describe(t.results),
  describe(t.rankingPoints),
]

export const uploadTable = (name: string) => UPLOAD_TABLES.find((table) => table.name === name)
