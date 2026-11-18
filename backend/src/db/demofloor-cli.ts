import { loadConfig } from '../config.ts'
import { openDatabase } from './client.ts'
import { addFloorDemo } from './demofloor.ts'
import { runMigrations } from './migrate.ts'

// pnpm --filter @bis/backend db:demo-floor
// Adds one small test competition with eight rounds waiting to start. Needs adjudicators A to I. Remove it with db:testdata:clear.
const config = loadConfig()
const { db, sqlite } = openDatabase(config.databasePath)
runMigrations(db)
const { competitionId, missing } = addFloorDemo(db)
sqlite.close()
if (missing.length > 0) {
  console.error(`Adjudicators ${missing.join(', ')} are missing. Add them first.`)
  process.exit(1)
}
console.log(`Added ${competitionId} to ${config.databasePath}: E1, E2 and E3 can start together; E4 to E8 cannot while those are marking.`)
