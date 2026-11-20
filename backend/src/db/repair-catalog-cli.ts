import { loadConfig } from '../config.ts'
import { openDatabase } from './client.ts'
import { runMigrations } from './migrate.ts'
import { repairCatalogRefs } from './repair-catalog.ts'

// pnpm --filter @bis/backend db:repair-catalog
// Puts back any age group or event kind that events, competitors or ranking points still name but the catalog no longer
// has: groups come back retired (named, never matched to a birth year), kinds as ordinary kinds. Safe to run again. Take a backup first.
const config = loadConfig()
const { db, sqlite } = openDatabase(config.databasePath)
runMigrations(db)
const done = repairCatalogRefs(sqlite)
sqlite.close()
console.log(`Age groups put back (retired): ${done.ageGroups.join(', ') || 'none'}`)
console.log(`Event kinds put back: ${done.kinds.join(', ') || 'none'}`)
