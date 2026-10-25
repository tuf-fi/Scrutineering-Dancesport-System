import { afterEach, describe, expect, it, vi } from 'vitest'
import { RequestLimiter } from './auth/ratelimit.ts'
import { loadConfig } from './config.ts'
import { startTestApp, type TestApp } from './testing.ts'

const apps: TestApp[] = []
afterEach(async () => {
  vi.useRealTimers()
  for (const app of apps.splice(0)) await app.close()
})
const start = async (env: Record<string, string>) => {
  const app = await startTestApp({ env })
  apps.push(app)
  return app
}
const read = (app: TestApp, ip: string, cookie?: string) =>
  app.app.inject({ method: 'POST', url: '/api/call/getCompetitions', payload: { args: [] }, remoteAddress: ip, headers: cookie ? { cookie } : {} })

describe('the limit on calls that need no sign-in', () => {
  it('stops one address after its share, tells it when to come back, and leaves others alone', async () => {
    const app = await start({ PUBLIC_RATE_LIMIT: '5' })
    for (let i = 0; i < 5; i++) expect((await read(app, '10.0.0.1')).statusCode).toBe(200)
    const blocked = await read(app, '10.0.0.1')
    expect(blocked.statusCode).toBe(429)
    expect(blocked.headers['retry-after']).toBe('60')
    expect((await read(app, '10.0.0.2')).statusCode).toBe(200)
  })

  it('does not count people who are signed in', async () => {
    const app = await start({ PUBLIC_RATE_LIMIT: '3' })
    const cookie = await app.signIn.staff('scrutineer')
    for (let i = 0; i < 20; i++) expect((await read(app, '10.0.1.1', cookie)).statusCode).toBe(200)
  })

  it('starts a fresh count after a minute', async () => {
    const app = await start({ PUBLIC_RATE_LIMIT: '2' })
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-10T08:00:00Z'))
    await read(app, '10.0.2.1')
    await read(app, '10.0.2.1')
    expect((await read(app, '10.0.2.1')).statusCode).toBe(429)
    vi.setSystemTime(new Date('2026-10-10T08:01:01Z'))
    expect((await read(app, '10.0.2.1')).statusCode).toBe(200)
  })

  it('can be turned off, and has a generous default', async () => {
    expect(loadConfig({}).publicRatePerMinute).toBe(600)
    expect(loadConfig({ PUBLIC_RATE_LIMIT: 'off' }).publicRatePerMinute).toBeNull()
    expect(() => loadConfig({ PUBLIC_RATE_LIMIT: 'lots' })).toThrow(/PUBLIC_RATE_LIMIT/)
    const app = await start({ PUBLIC_RATE_LIMIT: 'off' })
    for (let i = 0; i < 30; i++) expect((await read(app, '10.0.3.1')).statusCode).toBe(200)
  })
})

describe('RequestLimiter', () => {
  it('counts in a window and forgets visitors afterwards', () => {
    const limiter = new RequestLimiter(2, 1000)
    expect([limiter.take('a', 0), limiter.take('a', 1), limiter.take('a', 2)]).toEqual([true, true, false])
    expect(limiter.take('a', 1000)).toBe(true)
    limiter.take('b', 1500)
    limiter.take('c', 2600)
    expect(limiter.take('b', 2700)).toBe(true)
  })
})
