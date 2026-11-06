import { writeFileSync } from 'node:fs'
import { loadConfig } from '../config.ts'
import { openDatabase } from './client.ts'
import { exportDay } from './dayPackage.ts'
import { runMigrations } from './migrate.ts'

// pnpm --filter @bis/backend db:export-day -- --competition <id> [--out file.json]
// On the venue laptop, after the event: everything the day changed, as one file for the online server.
const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const config = loadConfig()
const { db, sqlite } = openDatabase(config.databasePath)
runMigrations(db)

const id = arg('--competition')
if (!id) {
  const rows = sqlite.prepare('SELECT id, name, date FROM competitions ORDER BY date DESC').all() as Array<{ id: string; name: string; date: string }>
  console.error('Say which competition with --competition <id>. The competitions here:')
  for (const c of rows) console.error(`  ${c.id}  ${c.date}  ${c.name}`)
  process.exit(1)
}
const out = arg('--out') ?? `bis-day-${id}.json`
const pkg = exportDay(sqlite, id)
writeFileSync(out, JSON.stringify(pkg))
sqlite.close()
const total = Object.values(pkg.replaced).reduce((n, rows) => n + rows.length, 0)
console.log(`Wrote ${out}: ${pkg.competitionName}, ${total} rows of the day (${pkg.replaced.marks?.length ?? 0} marks, ${pkg.replaced.results?.length ?? 0} results).`)
console.log('Copy this file to the online server and run db:import-day there.')
