import { loadConfig } from '../config.ts'
import { openDatabase } from './client.ts'
import { cleanSlate, countCleanSlate } from './clean-slate.ts'
import { runMigrations } from './migrate.ts'

// pnpm --filter @bis/backend db:clean-slate [--yes] [--catalog]
// Removes every competition, entry, payment, result and every team, coach, athlete and member account. Staff accounts,
// adjudicators, the points table and the settings stay. --catalog also puts the age groups, kinds and classes back to the
// organizer's defaults. Without --yes it only counts. Take a backup first.
const config = loadConfig()
const { db, sqlite } = openDatabase(config.databasePath)
runMigrations(db)
const apply = process.argv.includes('--yes')
const catalog = process.argv.includes('--catalog')

console.log(`In ${config.databasePath}:`)
for (const [table, n] of Object.entries(countCleanSlate(sqlite))) console.log(`  ${table}: ${n}`)
if (!apply) {
  console.log('Nothing removed. Run again with --yes to remove it.')
} else {
  cleanSlate(sqlite, { catalog })
  console.log(`Removed.${catalog ? ' The age groups, kinds and classes are back to the defaults.' : ''}`)
}
sqlite.close()
