import { randomUUID } from 'node:crypto'
import type { Sqlite } from './client.ts'

// Offline competition day. The venue laptop runs BIS on a copy of the database; afterwards the day's work goes back to the
// online server as one file. The online server holds the competition's day data still while the laptop has it, so the file
// replaces it: nothing is merged, nothing can disagree.

export const DAY_FORMAT = 'bis-day-1'

type Row = Record<string, unknown>

export interface DayPackage {
  format: typeof DAY_FORMAT
  competitionId: string
  competitionName: string
  exportedAt: string
  // Rows put back in place of the online server's rows for this competition, parents before children
  replaced: Record<string, Row[]>
  // Rows made at the venue that the online server may not have: teams, coaches, dancers, an extra event, audit entries
  added: Record<string, Row[]>
  // Back numbers given or changed at the venue
  backNumbers: Array<{ id: string; backNumber: number | null }>
}

export interface DayCounts {
  replaced: Record<string, number>
  added: Record<string, number>
  backNumbers: number
}

const EVENTS = 'SELECT id FROM events WHERE competition_id = ?'
const ROUNDS = `SELECT id FROM rounds WHERE event_id IN (${EVENTS})`
const HEATS = `SELECT id FROM heats WHERE round_id IN (${ROUNDS})`
const PANELS = `SELECT id FROM panels WHERE event_id IN (${EVENTS})`

// Parents first, so a table is put back after the tables it points to
const REPLACED: Array<{ table: string; where: string }> = [
  { table: 'payments', where: 'competition_id = ?' },
  { table: 'entries', where: `event_id IN (${EVENTS})` },
  { table: 'adjudicator_pins', where: 'competition_id = ?' },
  { table: 'panels', where: `event_id IN (${EVENTS})` },
  { table: 'panel_members', where: `panel_id IN (${PANELS})` },
  { table: 'program_starts', where: 'competition_id = ?' },
  { table: 'program_slots', where: 'competition_id = ?' },
  { table: 'rounds', where: `event_id IN (${EVENTS})` },
  { table: 'heats', where: `round_id IN (${ROUNDS})` },
  { table: 'heat_competitors', where: `heat_id IN (${HEATS})` },
  { table: 'marks', where: `round_id IN (${ROUNDS})` },
  { table: 'submissions', where: `round_id IN (${ROUNDS})` },
  { table: 'tie_decisions', where: `round_id IN (${ROUNDS})` },
  { table: 'final_tie_decisions', where: `round_id IN (${ROUNDS})` },
  { table: 'results', where: `event_id IN (${EVENTS})` },
  { table: 'ranking_points', where: 'competition_id = ?' },
]

// Put back only if the online server does not have the row already
const ADDED: Array<{ table: string; where: string | null }> = [
  { table: 'teams', where: null },
  { table: 'coaches', where: null },
  { table: 'adjudicators', where: null },
  { table: 'competitors', where: null },
  { table: 'events', where: 'competition_id = ?' },
  { table: 'audit_log', where: null },
]

const q = (name: string) => `"${name.replace(/"/g, '""')}"`

function columnsOf(sqlite: Sqlite, table: string): string[] {
  return (sqlite.prepare(`PRAGMA table_info(${q(table)})`).all() as Array<{ name: string }>).map((c) => c.name)
}

function competitionOf(sqlite: Sqlite, competitionId: string): { id: string; name: string } {
  const row = sqlite.prepare('SELECT id, name FROM competitions WHERE id = ?').get(competitionId) as { id: string; name: string } | undefined
  if (!row) throw new Error(`There is no competition "${competitionId}" in this database.`)
  return row
}

// What the venue laptop sends back after the event
export function exportDay(sqlite: Sqlite, competitionId: string): DayPackage {
  const competition = competitionOf(sqlite, competitionId)
  const select = (table: string, where: string | null) =>
    (where ? sqlite.prepare(`SELECT * FROM ${q(table)} WHERE ${where}`).all(competitionId) : sqlite.prepare(`SELECT * FROM ${q(table)}`).all()) as Row[]
  return {
    format: DAY_FORMAT,
    competitionId,
    competitionName: competition.name,
    exportedAt: new Date().toISOString(),
    replaced: Object.fromEntries(REPLACED.map((s) => [s.table, select(s.table, s.where)])),
    added: Object.fromEntries(ADDED.map((s) => [s.table, select(s.table, s.where)])),
    backNumbers: (sqlite.prepare('SELECT id, back_number AS backNumber FROM competitors').all() as DayPackage['backNumbers']),
  }
}

class Preview extends Error {}

// Puts a day's work into this database. With dryRun nothing is kept: the counts show what would happen.
export function importDay(sqlite: Sqlite, pkg: DayPackage, options: { dryRun?: boolean } = {}): DayCounts {
  if (!pkg || pkg.format !== DAY_FORMAT) throw new Error('This is not a BIS competition day file.')
  competitionOf(sqlite, pkg.competitionId)

  // Every column in the file must exist here, or the file came from a different version of BIS
  for (const [table, rows] of [...Object.entries(pkg.replaced), ...Object.entries(pkg.added)]) {
    if (rows.length === 0) continue
    const known = new Set(columnsOf(sqlite, table))
    for (const column of Object.keys(rows[0]!)) {
      if (!known.has(column)) throw new Error(`The file has "${table}.${column}", which this database does not. They are different versions of BIS: update this server first.`)
    }
  }

  const counts: DayCounts = { replaced: {}, added: {}, backNumbers: 0 }
  const insert = (verb: string, table: string, row: Row) => {
    const columns = Object.keys(row)
    return sqlite
      .prepare(`${verb} INTO ${q(table)} (${columns.map(q).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`)
      .run(...columns.map((c) => row[c] as never))
  }

  const run = sqlite.transaction(() => {
    // Foreign keys are checked when the changes are kept, so tables can be emptied and refilled in any order within it
    sqlite.pragma('defer_foreign_keys = ON')

    // Rows made at the venue first, because the day's rows point at them
    for (const spec of ADDED) {
      let n = 0
      for (const row of pkg.added[spec.table] ?? []) n += insert('INSERT OR IGNORE', spec.table, row).changes
      counts.added[spec.table] = n
    }

    // Back numbers: cleared and then set, so two dancers can swap numbers
    const numbers = pkg.backNumbers ?? []
    const clear = sqlite.prepare('UPDATE competitors SET back_number = NULL WHERE id = ?')
    const set = sqlite.prepare('UPDATE competitors SET back_number = ? WHERE id = ?')
    for (const b of numbers) clear.run(b.id)
    for (const b of numbers) if (b.backNumber !== null) set.run(b.backNumber, b.id)
    counts.backNumbers = numbers.length

    // The competition's day data: emptied from the last table to the first, then filled from the first to the last
    for (const spec of [...REPLACED].reverse()) sqlite.prepare(`DELETE FROM ${q(spec.table)} WHERE ${spec.where}`).run(pkg.competitionId)
    for (const spec of REPLACED) {
      const rows = pkg.replaced[spec.table] ?? []
      for (const row of rows) insert('INSERT', spec.table, row)
      counts.replaced[spec.table] = rows.length
    }

    // Nothing is on the floor any more
    sqlite.prepare('UPDATE competitions SET floor_round_id = NULL WHERE id = ?').run(pkg.competitionId)
    sqlite
      .prepare('INSERT INTO audit_log (id, actor_id, action, target, "before", "after", at) VALUES (?, ?, ?, ?, NULL, NULL, ?)')
      .run(randomUUID(), 'day-import', 'Imported the competition day', pkg.competitionName, new Date().toISOString())

    const broken = sqlite.pragma('foreign_key_check') as unknown[]
    if (broken.length > 0) throw new Error('The file does not fit this database: some rows point at rows that do not exist here.')
    if (options.dryRun) throw new Preview()
  })

  try {
    run()
  } catch (error) {
    if (!(error instanceof Preview)) throw error
  }
  return counts
}
