import { readFileSync } from 'node:fs'
import { compareResults } from '../compare.ts'
import { loadConfig } from '../config.ts'
import { openDatabase } from './client.ts'

// pnpm --filter @bis/backend results:compare <competition id> <paper-results.csv>
const [competitionId, file] = process.argv.slice(2)
if (!competitionId || !file) {
  console.error('Usage: results:compare <competition id> <paper-results.csv>')
  process.exit(1)
}
const { sqlite } = openDatabase(loadConfig().databasePath)
const result = compareResults(sqlite, competitionId, readFileSync(file, 'utf8'))
sqlite.close()

console.log(`${result.events} events, ${result.lines} lines on paper, ${result.matching} agree.`)
for (const line of result.unreadable) console.log(`Could not read: ${line}`)
for (const d of result.differences) {
  console.log(`Event ${d.event}, back number ${d.backNumber}: paper ${d.paper ?? 'not listed'}, BIS ${d.bis ?? 'not placed'}`)
}
console.log(result.differences.length === 0 && result.unreadable.length === 0 ? 'No differences.' : `${result.differences.length} differences.`)
process.exitCode = result.differences.length === 0 && result.unreadable.length === 0 ? 0 : 1
