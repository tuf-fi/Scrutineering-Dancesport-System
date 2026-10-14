import type { PaymentSettings } from '@bis/shared'
import type { Sqlite } from '../db/client.ts'
import { writePaymentSettings } from '../paymentSettings.ts'
import { withoutCapture } from './capture.ts'
import { DOWNLOAD_TABLES, uploadTable, type SyncTable } from './tables.ts'

type Value = string | number | null

// One change as it travels from the venue to the cloud
export interface SyncItem {
  entity: string
  operation: 'upsert' | 'delete'
  payload: Record<string, Value>
}

export interface SyncSnapshot {
  tables: Record<string, Array<Record<string, Value>>>
  // Entries left out because they are not paid yet
  excluded: { entries: number }
  // The organizer's fees and payment details; the venue needs the fees for late entries
  paymentSettings: PaymentSettings
}

const quote = (name: string) => `"${name}"`

// Only columns the table really has are ever written, whatever arrives
function knownColumns(table: SyncTable, payload: Record<string, unknown>): string[] {
  return Object.keys(payload).filter((c) => table.columns.includes(c))
}

function upsertSql(table: SyncTable, columns: string[]): string {
  const rest = columns.filter((c) => !table.primaryKey.includes(c))
  const action = rest.length > 0 ? `DO UPDATE SET ${rest.map((c) => `${quote(c)} = excluded.${quote(c)}`).join(', ')}` : 'DO NOTHING'
  return `INSERT INTO ${quote(table.name)} (${columns.map(quote).join(', ')}) VALUES (${columns.map(() => '?').join(', ')}) ON CONFLICT (${table.primaryKey.map(quote).join(', ')}) ${action}`
}

export interface AppliedChanges {
  applied: number
  // Rounds that became published in this batch, so the online site can tell spectators
  published: Array<{ roundId: string; eventId: string }>
  // Results or ranking points arrived
  rankingsChanged: boolean
}

// Applies the venue's changes, in order, all or nothing. Repeating a batch changes nothing, so a lost reply is harmless.
export function applyChanges(sqlite: Sqlite, items: SyncItem[]): AppliedChanges {
  const result: AppliedChanges = { applied: 0, published: [], rankingsChanged: false }
  const run = sqlite.transaction(() => {
    for (const item of items) {
      const table = uploadTable(item.entity)
      if (!table) throw new Error(`"${item.entity}" is not something the venue sends.`)
      if (item.operation === 'delete') {
        const where = table.primaryKey.map((c) => `${quote(c)} = ?`).join(' AND ')
        sqlite.prepare(`DELETE FROM ${quote(table.name)} WHERE ${where}`).run(...table.primaryKey.map((c) => item.payload[c] ?? null))
      } else {
        const columns = knownColumns(table, item.payload)
        if (table.primaryKey.some((c) => !columns.includes(c))) throw new Error(`A change to ${table.name} is missing its key.`)
        sqlite.prepare(upsertSql(table, columns)).run(...columns.map((c) => item.payload[c] ?? null))
      }
      if (item.entity === 'rounds' && item.operation === 'upsert' && item.payload.status === 'published') {
        result.published.push({ roundId: String(item.payload.id), eventId: String(item.payload.event_id) })
      }
      if (item.entity === 'results' || item.entity === 'ranking_points') result.rankingsChanged = true
      result.applied++
    }
  })
  // Changes that arrive here are not queued to go anywhere else
  withoutCapture(sqlite, () => run())
  return result
}

export interface AppliedSnapshot {
  added: Record<string, number>
}

// Puts a downloaded competition into the venue's database. Rows the venue already has are left alone, because from the
// moment of the download the venue owns them: back numbers, scratches and late entries made here are never overwritten.
// What is refreshed: the points table (the cloud's is the official one), and a payment the cloud has since approved.
export function applySnapshot(sqlite: Sqlite, snapshot: SyncSnapshot): AppliedSnapshot {
  const added: Record<string, number> = {}
  const run = sqlite.transaction(() => {
    for (const table of DOWNLOAD_TABLES) {
      const rows = snapshot.tables[table.name] ?? []
      if (table.name === 'points_table') sqlite.prepare('DELETE FROM points_table').run()
      let count = 0
      for (const row of rows) {
        const columns = knownColumns(table, row)
        const insert = `INSERT INTO ${quote(table.name)} (${columns.map(quote).join(', ')}) VALUES (${columns.map(() => '?').join(', ')}) ON CONFLICT DO NOTHING`
        const info = sqlite.prepare(insert).run(...columns.map((c) => row[c] ?? null))
        count += info.changes
        if (table.name === 'payments' && info.changes === 0) refreshPayment(sqlite, row)
      }
      added[table.name] = count
    }
  })
  withoutCapture(sqlite, () => run())
  if (snapshot.paymentSettings) writePaymentSettings(sqlite, snapshot.paymentSettings)
  return { added }
}

// A payment the club paid online and the admin has approved since the last download
function refreshPayment(sqlite: Sqlite, row: Record<string, Value>) {
  if (row.status !== 'approved' && row.status !== 'paid_at_venue') return
  sqlite
    .prepare(
      `UPDATE payments SET status = ?, amount_paid = ?, reference_number = ?, rejection_reason = ?, checked_by = ?, checked_at = ?
       WHERE id = ? AND status IN ('unpaid', 'for_checking', 'rejected')`,
    )
    .run(row.status, row.amount_paid ?? null, row.reference_number ?? null, row.rejection_reason ?? null, row.checked_by ?? null, row.checked_at ?? null, row.id)
}
