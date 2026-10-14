import { readFileSync } from 'node:fs'
import { request } from 'node:https'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from './app.ts'
import { loadConfig } from './config.ts'
import { openDatabase } from './db/client.ts'
import { runMigrations } from './db/migrate.ts'
import { SAMPLE_PASSWORD, seedSampleData } from './db/seed.ts'

// The server over HTTPS with the test-only certificate in test-fixtures/ (never used at a venue)
const fixtures = join(import.meta.dirname, '..', 'test-fixtures')
const cert = readFileSync(join(fixtures, 'localhost.crt'))

let app: Awaited<ReturnType<typeof buildApp>>
let sqlite: ReturnType<typeof openDatabase>['sqlite']
let port = 0

function https(method: 'GET' | 'POST', path: string, body?: object): Promise<{ status: number; headers: Record<string, unknown>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      { host: '127.0.0.1', port, path, method, ca: cert, servername: 'localhost', headers: body ? { 'content-type': 'application/json' } : {} },
      (res) => {
        let text = ''
        res.on('data', (chunk) => (text += chunk))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: text }))
      },
    )
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

beforeAll(async () => {
  const opened = openDatabase(':memory:')
  sqlite = opened.sqlite
  runMigrations(opened.db)
  seedSampleData(opened.db)
  const config = loadConfig({
    FRONTEND_DIR: '',
    TLS_CERT: join(fixtures, 'localhost.crt'),
    TLS_KEY: join(fixtures, 'localhost.key'),
  })
  app = await buildApp({ config, sqlite, db: opened.db, liveBoardMs: 0 })
  await app.listen({ port: 0, host: '127.0.0.1' })
  port = (app.server.address() as { port: number }).port
})
afterAll(async () => {
  await app.close()
  sqlite.close()
})

describe('serving over HTTPS', () => {
  it('answers on a secure connection', async () => {
    const res = await https('GET', '/api/health')
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ status: 'ok' })
  })

  it('marks the sign-in cookie Secure as well as httpOnly', async () => {
    const res = await https('POST', '/api/auth/staff', { username: 'admin', password: SAMPLE_PASSWORD })
    expect(res.status).toBe(200)
    const cookie = String(res.headers['set-cookie'])
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/Secure/i)
  })

  it('refuses a client that does not trust the certificate', async () => {
    await expect(
      new Promise((resolve, reject) => {
        const req = request({ host: '127.0.0.1', port, path: '/api/health', servername: 'localhost' }, resolve)
        req.on('error', reject)
        req.end()
      }),
    ).rejects.toThrow(/self[- ]signed|unable to verify|certificate/i)
  })
})
