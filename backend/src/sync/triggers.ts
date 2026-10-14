import { UPLOAD_TABLES, type SyncTable } from './tables.ts'

// Every change to an event-day table is written to the outbox by the database itself, so no part of the program can
// forget to queue something for upload. The triggers do nothing unless the setting `sync_capture` is `on`, which only
// a venue with a cloud address turns on, and which is switched off while a download is being applied.

const quote = (name: string) => `"${name}"`

// A JSON object of a row's sent columns, read from NEW., OLD., or (with no prefix) the row being selected
export function jsonObjectSql(table: SyncTable, row: 'NEW' | 'OLD' | ''): string {
  const prefix = row ? `${row}.` : ''
  return `json_object(${table.columns.map((c) => `'${c}', ${prefix}${quote(c)}`).join(', ')})`
}

const keyOf = (table: SyncTable, row: 'NEW' | 'OLD') => table.primaryKey.map((c) => `${row}.${quote(c)}`).join(` || ':' || `)

function trigger(table: SyncTable, event: 'INSERT' | 'UPDATE' | 'DELETE'): string {
  const row = event === 'DELETE' ? 'OLD' : 'NEW'
  const operation = event === 'DELETE' ? 'delete' : 'upsert'
  const name = `sync_${event.toLowerCase()}_${table.name}`
  return [
    `CREATE TRIGGER IF NOT EXISTS ${quote(name)} AFTER ${event} ON ${quote(table.name)}`,
    `WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'`,
    `BEGIN`,
    `  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)`,
    `  VALUES (lower(hex(randomblob(16))), '${table.name}', ${keyOf(table, row)}, '${operation}', ${jsonObjectSql(table, row)}, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));`,
    `END`,
  ].join('\n')
}

// The SQL statements of the migration that creates the triggers
export function captureTriggerStatements(): string[] {
  return UPLOAD_TABLES.flatMap((table) => (['INSERT', 'UPDATE', 'DELETE'] as const).map((event) => trigger(table, event)))
}

// How a custom migration file holds several statements
export const MIGRATION_BREAKPOINT = '--> statement-breakpoint'
export const captureMigrationSql = () => captureTriggerStatements().join(`\n${MIGRATION_BREAKPOINT}\n`) + '\n'
