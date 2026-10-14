import { loadConfig } from '../config.ts'
import { openDatabase } from './client.ts'
import { runMigrations } from './migrate.ts'

const config = loadConfig()
const { db, sqlite } = openDatabase(config.databasePath)
runMigrations(db)
sqlite.close()
console.log(`Database ready at ${config.databasePath}`)
