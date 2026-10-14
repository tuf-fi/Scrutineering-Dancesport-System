import { createAdmin } from '../auth/bootstrap.ts'
import { loadConfig } from '../config.ts'
import { openDatabase } from './client.ts'
import { runMigrations } from './migrate.ts'

// pnpm --filter @bis/backend admin:create <username> "<Full name>" [password]
const [username, name, password] = process.argv.slice(2)
if (!username || !name) {
  console.error('Usage: admin:create <username> "<Full name>" [password]')
  process.exit(1)
}

const config = loadConfig()
const { db, sqlite } = openDatabase(config.databasePath)
runMigrations(db)
try {
  const admin = createAdmin(db, { username, name, password })
  console.log(`Admin "${admin.username}" created in ${config.databasePath}.`)
  console.log(`Password: ${admin.password}`)
  console.log('Sign in and change it from the Staff screen.')
} catch (error) {
  console.error((error as Error).message)
  process.exitCode = 1
}
sqlite.close()
