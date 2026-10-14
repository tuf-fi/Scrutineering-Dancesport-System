import { buildApp } from './app.ts'
import { createBackups } from './backup.ts'
import { DEV_SECRET, loadConfig } from './config.ts'
import { openDatabase } from './db/client.ts'
import { runMigrations } from './db/migrate.ts'
import { databaseSecret } from './secret.ts'
import { setCapture } from './sync/capture.ts'

const config = loadConfig()
const { db, sqlite } = openDatabase(config.databasePath)
runMigrations(db)
// No COOKIE_SECRET chosen: use a random one kept in the database, so restarts and restored backups keep everyone signed in
if (config.cookieSecret === DEV_SECRET) config.cookieSecret = databaseSecret(db)

const backups = createBackups(sqlite, config.backupDirs, config.backupIntervalMinutes)
// A venue that is not set up for the cloud has nothing to send, so it does not queue changes
if (config.mode === 'cloud' || !config.cloudUrl) setCapture(sqlite, false)
const app = await buildApp({ config, sqlite, db, backups, startSync: true })
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
console.log(`BIS venue server on ${config.tlsCert ? 'https' : 'http'}://${config.host}:${config.port} (database ${config.databasePath})`)
