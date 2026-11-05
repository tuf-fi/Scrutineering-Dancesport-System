import { loadConfig } from '../config.ts'
import { openDatabase } from './client.ts'
import { runMigrations } from './migrate.ts'
import { addTestData } from './testdata.ts'

// pnpm --filter @bis/backend db:testdata [--yes]
// Adds fake teams, coaches, athletes, adjudicators and competitions. Nothing it adds can sign in, so it is safe on staging,
// but it is fake data: on a deployed server it needs --yes, and it never belongs on production.
if (process.env.BIS_DEPLOYED === 'true' && !process.argv.includes('--yes')) {
  console.error('This adds fake teams, athletes and competitions. Run it on staging only, and add --yes to confirm.')
  process.exit(1)
}

const config = loadConfig()
const { db, sqlite } = openDatabase(config.databasePath)
runMigrations(db)
const report = addTestData(db)
sqlite.close()
console.log(`Test data in ${config.databasePath}:`)
console.log(`  ${report.teams} teams, ${report.coaches} coaches, ${report.athletes} athletes (accounts and dancers)`)
console.log(`  ${report.pastCompetitions} finished competitions with results, ${report.upcomingCompetitions} upcoming competitions, 6 events each`)
console.log(`  ${report.adjudicators} adjudicators added${report.adjudicatorsSkipped > 0 ? ` (${report.adjudicatorsSkipped} not added: letters A to J are all there are)` : ''}`)
