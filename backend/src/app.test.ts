import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from './app.ts'
import { persistedSecret } from './secret.ts'
import { loadConfig } from './config.ts'
import { openDatabase } from './db/client.ts'
import { silentHub } from './realtime/hub.ts'
import { runMigrations } from './db/migrate.ts'

const closers: Array<() => unknown> = []
afterEach(async () => {
  for (const close of closers.splice(0)) await close()
})

async function start() {
  const { db, sqlite } = openDatabase(':memory:')
  runMigrations(db)
  const app = await buildApp({ config: loadConfig({ FRONTEND_DIR: '' }), sqlite, db, hub: silentHub(), liveBoardMs: 0 })
  closers.push(() => app.close(), () => sqlite.close())
  return { app, sqlite }
}

describe('health', () => {
  it('reports the mode and that the database answers', async () => {
    const { app } = await start()
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok', mode: 'venue', database: true })
  })

  it('reports an error when the database is gone', async () => {
    const { app, sqlite } = await start()
    sqlite.close()
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toMatchObject({ status: 'error', database: false })
    closers.pop()
  })

  it('answers 404 for an unknown route', async () => {
    const { app } = await start()
    expect((await app.inject({ method: 'GET', url: '/api/nope' })).statusCode).toBe(404)
  })
})

describe('serving the built frontend', () => {
  async function withFrontend() {
    const dir = mkdtempSync(join(tmpdir(), 'bis-web-'))
    mkdirSync(join(dir, 'assets'))
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>BIS</title>')
    writeFileSync(join(dir, 'assets', 'app.js'), 'console.log(1)')
    const { db, sqlite } = openDatabase(':memory:')
    runMigrations(db)
    const app = await buildApp({ config: loadConfig({ FRONTEND_DIR: dir }), sqlite, db, hub: silentHub(), liveBoardMs: 0 })
    closers.push(() => app.close(), () => sqlite.close(), () => rmSync(dir, { recursive: true, force: true }))
    return app
  }

  it('serves the page and its files', async () => {
    const app = await withFrontend()
    expect((await app.inject({ method: 'GET', url: '/' })).body).toContain('<title>BIS</title>')
    expect((await app.inject({ method: 'GET', url: '/assets/app.js' })).body).toBe('console.log(1)')
  })

  it('gives every screen address the page, so a refresh keeps the screen', async () => {
    const app = await withFrontend()
    const res = await app.inject({ method: 'GET', url: '/scrutineer/live?round=abc' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('<title>BIS</title>')
  })

  it('makes phones re-check the page, the service worker and the manifest, but keep hashed files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bis-web-'))
    mkdirSync(join(dir, 'assets'))
    for (const file of ['index.html', 'sw.js', 'manifest.webmanifest', 'workbox-abc123.js', 'assets/index-9f8e7d.js']) writeFileSync(join(dir, file), 'x')
    const { db, sqlite } = openDatabase(':memory:')
    runMigrations(db)
    const app = await buildApp({ config: loadConfig({ FRONTEND_DIR: dir }), sqlite, db, hub: silentHub(), liveBoardMs: 0 })
    closers.push(() => app.close(), () => sqlite.close(), () => rmSync(dir, { recursive: true, force: true }))

    const cache = async (url: string) => (await app.inject({ method: 'GET', url })).headers['cache-control']
    expect(await cache('/')).toBe('no-cache')
    expect(await cache('/sw.js')).toBe('no-cache')
    expect(await cache('/manifest.webmanifest')).toBe('no-cache')
    expect(await cache('/workbox-abc123.js')).toBe('no-cache')
    expect(await cache('/assets/index-9f8e7d.js')).toBe('public, max-age=31536000, immutable')
    // A screen address that is really the page gets the same no-cache
    expect(await cache('/scrutineer/live')).toBe('no-cache')
  })

  it('still answers 404 as JSON for an unknown API path', async () => {
    const app = await withFrontend()
    const res = await app.inject({ method: 'GET', url: '/api/nope' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ error: 'Unknown request.' })
  })
})

describe('the cookie secret', () => {
  it('is made once, beside the database, and is the same after a restart', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bis-secret-'))
    closers.push(() => rmSync(dir, { recursive: true, force: true }))
    const first = persistedSecret(join(dir, 'data', 'bis.db'))
    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(persistedSecret(join(dir, 'data', 'bis.db'))).toBe(first)
    // A different database folder gets its own
    expect(persistedSecret(join(dir, 'other', 'bis.db'))).not.toBe(first)
  })
})

describe('config', () => {
  it('serves HTTPS only when both a certificate and a key are given, and then marks cookies secure', () => {
    expect(loadConfig({}).tlsCert).toBeNull()
    expect(loadConfig({}).cookieSecure).toBe(false)
    expect(() => loadConfig({ TLS_CERT: 'a.crt' })).toThrow(/both TLS_CERT and TLS_KEY/)
    expect(() => loadConfig({ TLS_KEY: 'a.key' })).toThrow(/both TLS_CERT and TLS_KEY/)
    const tls = loadConfig({ TLS_CERT: 'a.crt', TLS_KEY: 'a.key' })
    expect(tls).toMatchObject({ tlsCert: 'a.crt', tlsKey: 'a.key', cookieSecure: true })
    expect(loadConfig({ TLS_CERT: 'a.crt', TLS_KEY: 'a.key', COOKIE_SECURE: 'false' }).cookieSecure).toBe(false)
  })

  it('has working defaults for development', () => {
    expect(loadConfig({})).toMatchObject({ mode: 'venue', port: 4000, host: '0.0.0.0', databasePath: './data/bis.db' })
  })

  it('reads the environment', () => {
    expect(loadConfig({ PORT: '5000', DATABASE_PATH: 'x.db' })).toMatchObject({ port: 5000, databasePath: 'x.db' })
  })

  it('rejects a bad port', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/PORT/)
    expect(() => loadConfig({ PORT: '70000' })).toThrow(/PORT/)
  })

  it('refuses the development secret in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/COOKIE_SECRET/)
    expect(loadConfig({ NODE_ENV: 'production', COOKIE_SECRET: 'long-random-value' }).cookieSecret).toBe('long-random-value')
  })
})
