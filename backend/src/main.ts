import { buildApp } from './app.ts'
import { createBackups } from './backup.ts'
import { DEV_SECRET, loadConfig } from './config.ts'
import { openDatabase } from './db/client.ts'
import { runMigrations } from './db/migrate.ts'
import { encryptLegacySecrets } from './auth/vault.ts'
import { databaseSecret } from './secret.ts'

const config = loadConfig()
const { db, sqlite } = openDatabase(config.databasePath)
runMigrations(db)
// No COOKIE_SECRET chosen: use a random one kept in the database, so restarts and restored backups keep everyone signed in
if (config.cookieSecret === DEV_SECRET) config.cookieSecret = databaseSecret(db)

// Authenticator secrets saved before encryption existed are encrypted now
encryptLegacySecrets(db, config.dataKey)

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
console.log(`BIS server on http://${config.host}:${config.port} (database ${config.databasePath})`)

