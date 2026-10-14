import type { SessionUser } from '@bis/shared'
import { buildApp } from './app.ts'
import { createBackups, type Backups } from './backup.ts'
import { loadConfig } from './config.ts'
import { openDatabase } from './db/client.ts'
import { runMigrations } from './db/migrate.ts'
import { SAMPLE_PASSWORD, seedSampleData } from './db/seed.ts'
import { silentHub } from './realtime/hub.ts'

export interface Reply<T = unknown> {
  status: number
  data: T
  error: string | undefined
}

export interface TestOptions {
  // Load the sample competition; false gives an empty database
  seed?: boolean
  path?: string
  backupDirs?: string[]
}

// Starts the whole server on an in-memory (or file) database with a silent hub, for tests
export async function startTestApp(options: TestOptions = {}) {
  const { db, sqlite } = openDatabase(options.path ?? ':memory:')
  runMigrations(db)
  if (options.seed !== false) seedSampleData(db)
  const hub = silentHub()
  const backups: Backups = options.backupDirs ? createBackups(sqlite, options.backupDirs, 0) : createBackups(sqlite, [], 0)
  const app = await buildApp({
    config: loadConfig({ FRONTEND_DIR: '' }),
    sqlite,
    db,
    hub,
    backups,
    liveBoardMs: 0,
  })

  async function cookieFrom(url: string, payload: object): Promise<string> {
    const res = await app.inject({ method: 'POST', url, payload })
    if (res.statusCode !== 200) throw new Error(`Sign-in failed: ${res.body}`)
    const header = res.headers['set-cookie']
    const raw = Array.isArray(header) ? header[0]! : String(header)
    return raw.split(';')[0]!
  }

  const signIn = {
    staff: (username: string, password = SAMPLE_PASSWORD) => cookieFrom('/api/auth/staff', { username, password }),
    adjudicator: (pin: string) => cookieFrom('/api/auth/adjudicator', { pin }),
    club: (email: string, password = SAMPLE_PASSWORD) => cookieFrom('/api/auth/club', { email, password }),
  }

  async function call<T = unknown>(name: string, args: unknown[] = [], cookie?: string): Promise<Reply<T>> {
    const res = await app.inject({
      method: 'POST',
      url: `/api/call/${name}`,
      payload: { args },
      headers: cookie ? { cookie } : {},
    })
    const body = res.json() as { data?: T; error?: string }
    return { status: res.statusCode, data: body.data as T, error: body.error }
  }

  // Calls and expects success
  async function ok<T = unknown>(name: string, args: unknown[], cookie?: string): Promise<T> {
    const reply = await call<T>(name, args, cookie)
    if (reply.status !== 200) throw new Error(`${name} failed (${reply.status}): ${reply.error}`)
    return reply.data
  }

  async function me(cookie: string): Promise<SessionUser | null> {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })
    return (res.json() as { data: SessionUser | null }).data
  }

  async function close() {
    await app.close()
    sqlite.close()
  }

  return { app, db, sqlite, hub, backups, signIn, call, ok, me, close }
}

export type TestApp = Awaited<ReturnType<typeof startTestApp>>
