import { DEFAULT_AGE_GROUPS, DEFAULT_CLASSES, DEFAULT_EVENT_KINDS } from '@bis/shared'
import type { Sqlite } from './client.ts'

// What a clean slate keeps: staff accounts, adjudicators, the points table and the settings (fees, payment methods, home page
// pictures). Everything about competitions and the people in them goes.
const TABLES_IN_ORDER = [
  'audit_log',
  'notifications',
  'member_notifications',
  'email_tokens',
  'entry_requests',
  'competitions',
  'competitors',
  'athlete_records',
  'athletes',
  'member_accounts',
  'teams',
  'coaches',
]

export interface CleanSlateReport {
  removed: Record<string, number>
  catalogReset: boolean
}

const exists = (sqlite: Sqlite, table: string) =>
  Boolean(sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table))

export function countCleanSlate(sqlite: Sqlite): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const table of TABLES_IN_ORDER) if (exists(sqlite, table)) counts[table] = (sqlite.prepare(`SELECT count(*) AS n FROM "${table}"`).get() as { n: number }).n
  return counts
}

// Removes every competition and the people around it. With `catalog`, the age groups, kinds and classes go back to the
// organizer's defaults too. The rest of the database is left as it is.
export function cleanSlate(sqlite: Sqlite, options: { catalog?: boolean } = {}): CleanSlateReport {
  const removed = countCleanSlate(sqlite)
  sqlite.pragma('foreign_keys = ON')
  sqlite.transaction(() => {
    for (const table of TABLES_IN_ORDER) if (exists(sqlite, table)) sqlite.prepare(`DELETE FROM "${table}"`).run()
    if (options.catalog) {
      sqlite.prepare('DELETE FROM age_groups').run()
      sqlite.prepare('DELETE FROM event_kinds').run()
      sqlite.prepare('DELETE FROM event_classes').run()
      const addGroup = sqlite.prepare('INSERT INTO age_groups (id, name, short, born_from, born_to, juvenile_fee, family, retired) VALUES (?, ?, ?, ?, ?, ?, NULL, 0)')
      for (const g of DEFAULT_AGE_GROUPS) addGroup.run(g.id, g.name, g.short, g.bornFrom, g.bornTo, g.juvenileFee ? 1 : 0)
      const addKind = sqlite.prepare('INSERT INTO event_kinds (id, name, fee_mode, beginners_only, closed_to_province, disciplines, requires, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      DEFAULT_EVENT_KINDS.forEach((k, i) => addKind.run(k.id, k.name, k.feeMode, k.beginnersOnly ? 1 : 0, k.closedToProvince ? 1 : 0, JSON.stringify(k.disciplines), JSON.stringify(k.requires), i))
      const addClass = sqlite.prepare('INSERT INTO event_classes (name, sort_order) VALUES (?, ?)')
      DEFAULT_CLASSES.forEach((c, i) => addClass.run(c.name, i))
    }
  })()
  const loose = sqlite.pragma('foreign_key_check') as unknown[]
  if (loose.length > 0) throw new Error(`The clean slate left ${loose.length} rows pointing at rows that do not exist`)
  return { removed, catalogReset: Boolean(options.catalog) }
}
