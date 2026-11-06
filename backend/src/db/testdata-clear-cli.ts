import { loadConfig } from '../config.ts'
import { openDatabase } from './client.ts'

// pnpm --filter @bis/backend db:testdata:clear [--yes]
// Removes what testdata-cli and testaccounts-cli added: every row whose id starts with "td-", what refers to those rows,
// and the logins on @testdata.example. Without --yes it only counts. Take a backup first.
const config = loadConfig()
const { sqlite } = openDatabase(config.databasePath)

const tables = (sqlite.prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name != '__drizzle_migrations'").all() as { name: string }[]).map((r) => r.name)
const columns = (table: string) => (sqlite.prepare(`pragma table_info("${table}")`).all() as { name: string }[]).map((c) => c.name)

// Where a table's rows belong to the test data, by the columns it has
const tests = (table: string): string[] => {
  const cols = columns(table)
  const own = ['id', 'event_id', 'competition_id', 'competitor_id', 'panel_id', 'team_id', 'coach_id', 'athlete_id', 'adjudicator_id'].filter((c) => cols.includes(c))
  const where = own.map((c) => `"${c}" like 'td-%'`)
  if (table === 'staff_users') where.push(`"username" like '%@testdata.example'`)
  if (table === 'athletes' || table === 'member_accounts') where.push(`"email" like '%@testdata.example'`)
  return where
}

const plan = tables.map((table) => ({ table, where: tests(table) })).filter((p) => p.where.length > 0)
const count = (p: { table: string; where: string[] }) => (sqlite.prepare(`select count(*) c from "${p.table}" where ${p.where.join(' or ')}`).get() as { c: number }).c
const found = plan.map((p) => ({ ...p, n: count(p) })).filter((p) => p.n > 0)

// Rows left pointing at a row that is gone (marks or heats of a deleted competitor, say) stop the server from starting
type Orphan = { table: string; rowid: number | null }
const orphans = () => (sqlite.pragma('foreign_key_check') as Orphan[]).filter((o) => o.rowid !== null)
const loose = orphans()

console.log(`Test data in ${config.databasePath}:`)
for (const p of found) console.log(`  ${p.table}: ${p.n}`)
if (found.length === 0) console.log('  none')
if (loose.length > 0) {
  const byTable = new Map<string, number>()
  for (const o of loose) byTable.set(o.table, (byTable.get(o.table) ?? 0) + 1)
  console.log('Rows pointing at a missing row:')
  for (const [table, n] of byTable) console.log(`  ${table}: ${n}`)
}

if (found.length + loose.length > 0 && !process.argv.includes('--yes')) console.log('Nothing deleted. Run again with --yes to delete these rows.')
else if (found.length + loose.length > 0) {
  sqlite.pragma('foreign_keys = OFF')
  sqlite.transaction(() => {
    for (const p of found) sqlite.prepare(`delete from "${p.table}" where ${p.where.join(' or ')}`).run()
    // Removing a loose row can leave another loose, so go round until none are left
    for (let pass = 0; pass < 10; pass++) {
      const rows = orphans()
      if (rows.length === 0) break
      for (const o of rows) sqlite.prepare(`delete from "${o.table}" where rowid = ?`).run(o.rowid)
    }
  })()
  sqlite.pragma('foreign_keys = ON')
  console.log(`Deleted. Rows left that point at a missing row: ${(sqlite.pragma('foreign_key_check') as unknown[]).length}`)
}
sqlite.close()
