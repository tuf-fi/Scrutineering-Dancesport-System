export interface Config {
  // Venue mode uses SQLite and needs no internet; cloud mode arrives in phase 5
  mode: 'venue'
  port: number
  host: string
  databasePath: string
  cookieSecret: string
  // Only over HTTPS; the venue network is plain HTTP
  cookieSecure: boolean
  // Where database backups are copied: a USB drive and Laptop 3 on competition day
  backupDirs: string[]
  backupIntervalMinutes: number
  // The built frontend, served by this server so other devices only need a browser
  frontendDir: string | null
}

// Stands for "no secret chosen"; main.ts replaces it with a random one kept beside the database
export const DEV_SECRET = 'change-me-before-the-competition'

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? 4000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be 1 to 65535, got "${env.PORT}"`)
  }
  const cookieSecret = env.COOKIE_SECRET ?? DEV_SECRET
  if (env.NODE_ENV === 'production' && cookieSecret === DEV_SECRET) {
    throw new Error('Set COOKIE_SECRET before running a real competition.')
  }
  return {
    mode: 'venue',
    port,
    host: env.HOST ?? '0.0.0.0',
    databasePath: env.DATABASE_PATH ?? './data/bis.db',
    cookieSecret,
    cookieSecure: env.COOKIE_SECURE === 'true',
    backupDirs: (env.BACKUP_DIRS ?? './data/backups').split(',').map((d) => d.trim()).filter(Boolean),
    backupIntervalMinutes: Number(env.BACKUP_INTERVAL_MINUTES ?? 5),
    frontendDir: env.FRONTEND_DIR === '' ? null : (env.FRONTEND_DIR ?? '../frontend/dist'),
  }
}
