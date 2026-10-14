import { statSync } from 'node:fs'
import { loadConfig } from '../config.ts'
import { inspectBackup, newestBackup, restoreDatabase } from '../restore.ts'

// pnpm --filter @bis/backend restore [backup file or folder] [--replace]
// With nothing named, the newest copy in BACKUP_DIRS is used.
const args = process.argv.slice(2)
const replace = args.includes('--replace')
const named = args.find((a) => !a.startsWith('--'))
const config = loadConfig()

function chooseBackup(): string {
  if (named && statSync(named, { throwIfNoEntry: false })?.isFile()) return named
  const found = newestBackup(named ? [named] : config.backupDirs)
  if (!found) throw new Error(`No backup copy found in ${named ?? config.backupDirs.join(', ')}.`)
  return found
}

try {
  const from = chooseBackup()
  const summary = inspectBackup(from)
  console.log(`Backup: ${from}`)
  console.log(`  last action recorded: ${summary.lastAction ?? 'none'}`)
  console.log(`  ${summary.competitions} competitions, ${summary.events} events, ${summary.marks} marks, ${summary.results} results`)
  const result = restoreDatabase({ from, to: config.databasePath, replace })
  console.log(`Restored to ${config.databasePath}.`)
  if (result.keptAs) console.log(`The database that was there is kept as ${result.keptAs}.`)
  console.log('Start the server with: pnpm venue')
} catch (error) {
  console.error((error as Error).message)
  process.exitCode = 1
}
