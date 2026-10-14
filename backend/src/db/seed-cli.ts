import { loadConfig } from '../config.ts'
import { openDatabase } from './client.ts'
import { runMigrations } from './migrate.ts'
import { SAMPLE_PASSWORD, hasData, seedSampleData } from './seed.ts'

const config = loadConfig()
const { db, sqlite } = openDatabase(config.databasePath)
runMigrations(db)

if (hasData(db)) {
  console.error(`${config.databasePath} already has data. Delete the file to start again.`)
  process.exitCode = 1
} else {
  seedSampleData(db)
  console.log(`Sample competition loaded into ${config.databasePath}`)
  console.log(`Staff usernames: admin, secretariat, scrutineer, chairperson, mc. Password for all: ${SAMPLE_PASSWORD}`)
}
sqlite.close()
