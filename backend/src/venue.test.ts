import { Role } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { accessNames, endpoint } from './registry.ts'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { startTestApp, type TestApp } from './testing.ts'

// The venue laptop has no internet: every role and the public pages must work with no call leaving the machine

const COMP = 'comp-sorsogon-2026'
let app: TestApp
const cookies = new Map<string, string>()
let fetchCalls = 0

beforeAll(async () => {
  vi.stubGlobal('fetch', async () => {
    fetchCalls++
    throw new Error('No internet at the venue')
  })
  app = await startTestApp({ env: { BIS_VENUE: 'true' } })
  const admin = await app.signIn.staff('admin')
  cookies.set(Role.Admin, admin)
  for (const role of [Role.Secretariat, Role.Scrutineer, Role.Chairperson, Role.Compere]) cookies.set(role, await app.signIn.staff(role))
  app.db.insert(t.staffUsers).values({ id: 'barker-1', name: 'Barker One', username: 'barker@sample.example', role: 'barker', passwordHash: hashPassword('pw-barker'), disabled: false }).run()
  cookies.set(Role.Barker, await app.signIn.staff('barker', 'pw-barker'))
  cookies.set(Role.Athlete, await app.signIn.athleteSignUp('Ana Reyes', 'ana@venue.example', 'long-enough-pass'))
  cookies.set(Role.Coach, await app.signIn.memberSignUp('coach', 'Coach Cruz', 'coach@venue.example', 'long-enough-pass'))
  cookies.set(Role.Team, await app.signIn.memberSignUp('team', 'Venue Team', 'team@venue.example', 'long-enough-pass'))
  await app.ok('generatePins', [COMP], admin)
  const pin = (app.sqlite.prepare('SELECT pin FROM adjudicator_pins WHERE competition_id = ? LIMIT 1').get(COMP) as { pin: string }).pin
  cookies.set(Role.Adjudicator, await app.signIn.adjudicator(pin))
})
afterAll(async () => {
  vi.unstubAllGlobals()
  await app.close()
})

describe('the venue laptop', () => {
  it('says it is the venue and answers the health check', async () => {
    const res = await app.app.inject({ method: 'GET', url: '/api/health' })
    expect(res.json()).toMatchObject({ status: 'ok', mode: 'venue' })
  })

  it('lets every public page read what it needs, with nobody signed in', async () => {
    const reads = accessNames().filter((n) => endpoint(n)?.access === 'public' && /^get/.test(n))
    expect(reads.length).toBeGreaterThan(15)
    for (const name of reads) {
      const reply = await app.call(name, [COMP])
      expect(reply.status, `${name}: ${reply.error}`).toBeLessThan(500)
      expect(reply.status, name).not.toBe(401)
      expect(reply.status, name).not.toBe(403)
    }
  })

  for (const role of Object.values(Role)) {
    it(`lets the ${role} use every read it is allowed`, async () => {
      const cookie = cookies.get(role)
      if (!cookie) return
      const reads = accessNames().filter((n) => {
        const access = endpoint(n)?.access
        return /^get/.test(n) && Array.isArray(access) && access.includes(role)
      })
      for (const name of reads) {
        const reply = await app.call(name, [COMP], cookie)
        expect(reply.status, `${name}: ${reply.error}`).toBeLessThan(500)
        expect(reply.status, name).not.toBe(401)
        expect(reply.status, name).not.toBe(403)
      }
    })
  }

  it('keeps staff changes working, since nothing is paused on the laptop itself', async () => {
    const reply = await app.call('clearFloor', [COMP], cookies.get(Role.Scrutineer))
    expect(reply.error ?? '').not.toMatch(/venue laptop|paused/)
  })

  it('never reached for the internet', () => {
    expect(fetchCalls).toBe(0)
  })
})
