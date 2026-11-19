import { loadConfig } from '../config.ts'
import { openDatabase } from './client.ts'
import { runMigrations } from './migrate.ts'
import { addProgramDemo } from './programdemo.ts'

// pnpm --filter @bis/backend db:demo-program
// Adds one test competition dated today with a running program: two events finished, one semi-final on the floor, the rest waiting.
// Remove it with db:testdata:clear.
const config = loadConfig()
const { db, sqlite } = openDatabase(config.databasePath)
runMigrations(db)
const { competitionId } = addProgramDemo(db)
sqlite.close()
console.log(`Added ${competitionId} to ${config.databasePath}: E1 and E2 finished (red), E3 semi-final on the floor (green), E3 final next (blue), the rest not started (white).`)
