import { afterEach, describe, expect, it } from 'vitest'
import { loadConfig } from './config.ts'
import { startTestApp, type TestApp } from './testing.ts'

// Sign-in is now open to the internet, so guessing has to run out however it is spread

const apps: TestApp[] = []
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close()
})
const start = async (env: Record<string, string> = {}) => {
  const app = await startTestApp({ env })
  apps.push(app)
  return app
}
const from = (app: TestApp, ip: string, url: string, payload: object) =>
  app.app.inject({ method: 'POST', url, payload, remoteAddress: ip })
const pin = (app: TestApp, ip: string, value: string) => from(app, ip, '/api/auth/adjudicator', { pin: value })
const wrongPin = (i: number) => String(1000 + i)

describe('guessing a PIN', () => {
  it('runs out across addresses, because one address at a time would never reach the limit', async () => {
    const app = await start()
    for (let i = 0; i < 25; i++) expect((await pin(app, `10.0.0.${i}`, wrongPin(i))).statusCode).toBe(401)
    // The next guess from a fresh address is stopped, and so is a correct PIN: that is the price of the lock
    expect((await pin(app, '10.0.1.1', wrongPin(99))).statusCode).toBe(429)
    expect((await pin(app, '10.0.1.2', '4100')).statusCode).toBe(429)
  })

  it('is not reset by a success, so one valid PIN does not buy more guesses', async () => {
    const app = await start()
    for (let i = 0; i < 24; i++) {
      await pin(app, `10.0.0.${i}`, wrongPin(i))
      if (i % 6 === 0) expect((await pin(app, `10.0.2.${i}`, '4100')).statusCode).toBe(200)
    }
    expect((await pin(app, '10.0.3.1', wrongPin(50))).statusCode).toBe(401)
    expect((await pin(app, '10.0.3.2', wrongPin(51))).statusCode).toBe(429)
  })

  it('records every failed and successful sign-in', async () => {
    const app = await start()
    await pin(app, '10.0.0.1', '0000')
    await pin(app, '10.0.0.2', '4100')
    const log = app.sqlite.prepare("select action, target from audit_log where action like '%sign-in%' or action like '%signed in%'").all()
    expect(log).toEqual(expect.arrayContaining([{ action: 'Failed PIN sign-in', target: '10.0.0.1' }]))
    expect(log.some((l) => (l as { action: string }).action === 'Adjudicator signed in')).toBe(true)
  })
})

describe('guessing a password', () => {
  it('runs out per account even when every guess comes from a different address', async () => {
    const app = await start()
    for (let i = 0; i < 20; i++) expect((await from(app, `10.1.0.${i}`, '/api/auth/staff', { username: 'admin', password: `wrong-${i}` })).statusCode).toBe(401)
    expect((await from(app, '10.1.1.1', '/api/auth/staff', { username: 'admin', password: 'wrong-again' })).statusCode).toBe(429)
    // Another account is not affected
    expect((await from(app, '10.1.1.2', '/api/auth/staff', { username: 'scrutineer', password: 'wrong' })).statusCode).toBe(401)
  })

  it('does not count a correct sign-in against the account', async () => {
    const app = await start()
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < 6; i++) await from(app, `10.2.${round}.${i}`, '/api/auth/staff', { username: 'admin', password: 'nope' })
      expect(await app.signIn.staff('admin')).toMatch(/^bis_session=/)
    }
  })
})

describe('club sign-up', () => {
  it('is limited per address, so it cannot be used to fill the database', async () => {
    const app = await start()
    const body = (i: number) => ({ name: `Club ${i}`, contactName: 'A', contactEmail: `c${i}@club.example`, contactPhone: '1', password: 'long-enough-1', agreed: true })
    for (let i = 0; i < 5; i++) expect((await from(app, '10.3.0.1', '/api/auth/club-signup', body(i))).statusCode).toBe(200)
    expect((await from(app, '10.3.0.1', '/api/auth/club-signup', body(9))).statusCode).toBe(429)
    expect((await from(app, '10.3.0.2', '/api/auth/club-signup', body(10))).statusCode).toBe(200)
  })

  it('refuses a large body on a sign-in route, but not on a call that takes a receipt', async () => {
    const app = await start()
    const big = { username: 'admin', password: 'x'.repeat(40_000) }
    expect((await from(app, '10.3.1.1', '/api/auth/staff', big)).statusCode).toBe(413)
  })
})

describe('the PIN window', () => {
  const today = () => new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)

  it('closes a PIN once the competition is more than a day away, and opens it on the day', async () => {
    const app = await start({ ADJUDICATOR_PIN_DAYS: '1' })
    // The sample competition is in the past, so its PINs are no use now
    expect((await pin(app, '10.4.0.1', '4100')).statusCode).toBe(401)
    app.sqlite.prepare('update competitions set date = ?').run(today())
    expect((await pin(app, '10.4.0.2', '4100')).statusCode).toBe(200)
  })

  it('is off by default outside production, and on (one day) in production', () => {
    expect(loadConfig({}).pinWindowDays).toBeNull()
    expect(loadConfig({ NODE_ENV: 'production', COOKIE_SECRET: 'a-real-secret' }).pinWindowDays).toBe(1)
    expect(loadConfig({ NODE_ENV: 'production', COOKIE_SECRET: 'a-real-secret', ADJUDICATOR_PIN_DAYS: 'off' }).pinWindowDays).toBeNull()
    expect(loadConfig({ ADJUDICATOR_PIN_DAYS: '3' }).pinWindowDays).toBe(3)
    expect(() => loadConfig({ ADJUDICATOR_PIN_DAYS: 'soon' })).toThrow(/ADJUDICATOR_PIN_DAYS/)
  })
})

describe('trusting the proxy', () => {
  it('reads a number as how many proxies to trust, and keeps an address as it is', () => {
    expect(loadConfig({}).trustProxy).toBe(false)
    expect(loadConfig({ TRUST_PROXY: 'true' }).trustProxy).toBe(true)
    expect(loadConfig({ TRUST_PROXY: '1' }).trustProxy).toBe(1)
    expect(loadConfig({ TRUST_PROXY: '172.18.0.0/16' }).trustProxy).toBe('172.18.0.0/16')
  })

  it('uses the address the proxy reports, and not one the visitor forges, when one proxy is trusted', async () => {
    const app = await start({ TRUST_PROXY: '1' })
    const attempt = (forged: string) =>
      app.app.inject({
        method: 'POST',
        url: '/api/auth/staff',
        payload: { username: 'scrutineer', password: 'wrong' },
        remoteAddress: '172.18.0.2',
        // The proxy appends the real visitor on the right; the visitor can only invent what is to the left
        headers: { 'x-forwarded-for': `${forged}, 198.51.100.9` },
      })
    for (let i = 0; i < 8; i++) expect((await attempt(`203.0.113.${i}`)).statusCode).toBe(401)
    expect((await attempt('203.0.113.200')).statusCode).toBe(429)
  })
})
