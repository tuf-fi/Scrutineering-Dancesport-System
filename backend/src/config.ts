import { hostname } from 'node:os'

export interface Config {
  // Venue: runs the competition on the laptop with no internet. Cloud: the online server for registration, payments and
  // public results. It is the same program and the same database layout; the venue-only functions are off online.
  mode: 'venue' | 'cloud'
  port: number
  host: string
  databasePath: string
  cookieSecret: string
  // Only over HTTPS; the venue network is plain HTTP unless a certificate is given
  cookieSecure: boolean
  // Serve over HTTPS, which phones need before they will keep an offline copy of the app
  tlsCert: string | null
  tlsKey: string | null
  // Where database backups are copied: a USB drive and Laptop 3 on competition day
  backupDirs: string[]
  backupIntervalMinutes: number
  // The built frontend, served by this server so other devices only need a browser
  frontendDir: string | null
  // Venue only: this laptop's name, and the cloud server it uploads to and downloads from. Without a cloud address the
  // venue works on its own and nothing is queued for upload.
  venueId: string
  cloudUrl: string | null
  syncToken: string | null
  // Cloud only: which venues may sync, as venue name -> secret. Without any, the sync routes are off.
  syncTokens: Record<string, string>
  // Cloud behind a proxy such as Caddy: trust it for the visitor's address (used to limit sign-in guesses)
  trustProxy: boolean
  // Venue: how long after a change before it is sent to the cloud (tests slow it down to control when sending happens)
  syncDelayMs: number
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
  if (Boolean(env.TLS_CERT) !== Boolean(env.TLS_KEY)) throw new Error('Set both TLS_CERT and TLS_KEY, or neither.')
  const mode = env.MODE ?? 'venue'
  if (mode !== 'venue' && mode !== 'cloud') throw new Error(`MODE must be venue or cloud, got "${env.MODE}"`)
  if (env.CLOUD_URL && !env.SYNC_TOKEN) throw new Error('Set SYNC_TOKEN as well as CLOUD_URL.')
  const syncTokens: Record<string, string> = {}
  for (const pair of (env.SYNC_TOKENS ?? '').split(',').map((p) => p.trim()).filter(Boolean)) {
    const [venue, ...rest] = pair.split('=')
    const token = rest.join('=')
    if (!venue || token.length < 16) throw new Error('SYNC_TOKENS is "venue=secret,venue=secret", each secret at least 16 characters.')
    syncTokens[venue.trim()] = token
  }
  return {
    mode,
    port,
    host: env.HOST ?? '0.0.0.0',
    databasePath: env.DATABASE_PATH ?? './data/bis.db',
    cookieSecret,
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : Boolean(env.TLS_CERT),
    tlsCert: env.TLS_CERT || null,
    tlsKey: env.TLS_KEY || null,
    backupDirs: (env.BACKUP_DIRS ?? './data/backups').split(',').map((d) => d.trim()).filter(Boolean),
    backupIntervalMinutes: Number(env.BACKUP_INTERVAL_MINUTES ?? 5),
    frontendDir: env.FRONTEND_DIR === '' ? null : (env.FRONTEND_DIR ?? '../frontend/dist'),
    venueId: env.VENUE_ID || hostname(),
    cloudUrl: env.CLOUD_URL ? env.CLOUD_URL.replace(/\/+$/, '') : null,
    syncToken: env.SYNC_TOKEN || null,
    syncTokens,
    trustProxy: env.TRUST_PROXY === 'true',
    syncDelayMs: Number(env.SYNC_DELAY_MS ?? 2000),
  }
}
