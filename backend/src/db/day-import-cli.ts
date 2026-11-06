import { readFileSync } from 'node:fs'
import { loadConfig } from '../config.ts'
import { openDatabase } from './client.ts'
import { importDay, type DayPackage } from './dayPackage.ts'
import { runMigrations } from './migrate.ts'

// pnpm --filter @bis/backend db:import-day -- --file bis-day-<id>.json [--yes]
// On the online server: puts the venue laptop's competition day in place of this server's copy of it.
// Without --yes it only shows what would change and keeps nothing.
const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const file = arg('--file')
if (!file) {
  console.error('Say which file with --file <bis-day-….json>.')
  process.exit(1)
}
const yes = process.argv.includes('--yes')

const config = loadConfig()
const { db, sqlite } = openDatabase(config.databasePath)
runMigrations(db)
const pkg = JSON.parse(readFileSync(file, 'utf8')) as DayPackage
try {
  const counts = importDay(sqlite, pkg, { dryRun: !yes })
  console.log(`${yes ? 'Imported' : 'Would import'} ${pkg.competitionName} (made ${pkg.exportedAt}):`)
  for (const [table, n] of Object.entries(counts.replaced)) if (n > 0) console.log(`  ${table}: ${n}`)
  for (const [table, n] of Object.entries(counts.added)) if (n > 0) console.log(`  ${table} added: ${n}`)
  console.log(`  back numbers: ${counts.backNumbers}`)
  if (!yes) console.log('Nothing was changed. Run again with --yes to keep it.')
} catch (error) {
  console.error((error as Error).message)
  process.exitCode = 1
}
sqlite.close()
