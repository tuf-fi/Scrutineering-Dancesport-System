import { buildApp } from './app.ts'
import { createBackups } from './backup.ts'
import { DEV_SECRET, loadConfig } from './config.ts'
import { openDatabase } from './db/client.ts'
import { runMigrations } from './db/migrate.ts'
import { persistedSecret } from './secret.ts'

const config = loadConfig()
// No COOKIE_SECRET chosen: use a random one that survives restarts
if (config.cookieSecret === DEV_SECRET) config.cookieSecret = persistedSecret(config.databasePath)
const { db, sqlite } = openDatabase(config.databasePath)
runMigrations(db)

const backups = createBackups(sqlite, config.backupDirs, config.backupIntervalMinutes)
const app = await buildApp({ config, sqlite, db, backups })
backups.start()
void backups.run()

async function shutdown() {
  await app.close()
  sqlite.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

await app.listen({ port: config.port, host: config.host })
console.log(`BIS venue server on http://${config.host}:${config.port} (database ${config.databasePath})`)
