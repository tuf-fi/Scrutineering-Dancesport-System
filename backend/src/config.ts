export interface Config {
  port: number
  host: string
  databasePath: string
  cookieSecret: string
  // Only over HTTPS: on by default in production, where the proxy in front (Caddy) speaks HTTPS
  cookieSecure: boolean
  // Where database backups are copied
  backupDirs: string[]
  backupIntervalMinutes: number
  // The built frontend, served by this server so other devices only need a browser
  frontendDir: string | null
  // Behind a proxy such as Caddy: trust it for the visitor's address (used to limit sign-in guesses)
  trustProxy: boolean
  // The organizer's Facebook Page, used to message clubs about their payments. Without a token it is off.
  messenger: { pageToken: string | null; pageUsername: string | null; verifyToken: string | null; appSecret: string | null }
}

// Stands for "no secret chosen"; main.ts replaces it with a random one kept beside the database
export const DEV_SECRET = 'change-me-before-the-competition'

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? 4000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be 1 to 65535, got "${env.PORT}"`)
  }
  const cookieSecret = env.COOKIE_SECRET || DEV_SECRET
  if (env.NODE_ENV === 'production' && cookieSecret === DEV_SECRET) {
    throw new Error('Set COOKIE_SECRET before running a real competition.')
  }
  return {
    port,
    host: env.HOST ?? '0.0.0.0',
    databasePath: env.DATABASE_PATH ?? './data/bis.db',
    cookieSecret,
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : env.NODE_ENV === 'production',
    backupDirs: (env.BACKUP_DIRS ?? './data/backups').split(',').map((d) => d.trim()).filter(Boolean),
    backupIntervalMinutes: Number(env.BACKUP_INTERVAL_MINUTES ?? 5),
    frontendDir: env.FRONTEND_DIR === '' ? null : (env.FRONTEND_DIR ?? '../frontend/dist'),
    trustProxy: env.TRUST_PROXY === 'true',
    messenger: {
      pageToken: env.MESSENGER_PAGE_TOKEN || null,
      pageUsername: env.MESSENGER_PAGE_USERNAME || null,
      verifyToken: env.MESSENGER_VERIFY_TOKEN || null,
      appSecret: env.MESSENGER_APP_SECRET || null,
    },
  }
}
