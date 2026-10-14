import { API_FUNCTIONS, Role } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { accessNames, endpoint, endpointNames } from './registry.ts'
import { startTestApp, type TestApp } from './testing.ts'

let app: TestApp
const cookies: Record<string, string | undefined> = {}

beforeAll(async () => {
  app = await startTestApp()
  cookies.admin = await app.signIn.staff('admin')
  cookies.secretariat = await app.signIn.staff('secretariat')
  cookies.scrutineer = await app.signIn.staff('scrutineer')
  cookies.chairperson = await app.signIn.staff('chairperson')
  cookies.mc = await app.signIn.staff('mc')
  cookies.adjudicator = await app.signIn.adjudicator('4100')
  const club = (await app.ok<Array<{ contactEmail: string }>>('getClubs', [], cookies.admin))[0]!
  cookies.club = await app.signIn.club(club.contactEmail)
})
afterAll(() => app.close())

describe('the permission table', () => {
  it('has a rule for every function and a function for every rule', () => {
    expect([...accessNames()].sort()).toEqual([...endpointNames()].sort())
  })

  it('matches the list of functions the client is built from', () => {
    expect([...endpointNames()].sort()).toEqual([...API_FUNCTIONS].sort())
  })

  it('treats anything that is not a read as a write', () => {
    for (const name of endpointNames()) {
      expect(endpoint(name)!.write).toBe(!name.startsWith('get'))
    }
  })
})

const ROLES = ['none', Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson, Role.Mc, Role.Adjudicator, Role.Club] as const

describe('every function against every role', () => {
  // Calls each function with no arguments: it must be refused for the wrong role, and for the right
  // role fail with a message (never crash the server) because the arguments are missing.
  for (const role of ROLES) {
    it(`as ${role}`, async () => {
      const crashed: string[] = []
      const wrong: string[] = []
      for (const name of endpointNames()) {
        // Functions that exist only online are not there on a venue server, whoever asks
        if (endpoint(name)!.mode === 'cloud') {
          expect((await app.call(name, [], role === 'none' ? undefined : cookies[role])).status).toBe(404)
          continue
        }
        const rule = endpoint(name)!.access
        const may = rule === 'public' || (role !== 'none' && (rule === 'signedIn' || rule.includes(role as Role)))
        const reply = await app.call(name, [], role === 'none' ? undefined : cookies[role])
        if (reply.status === 500) crashed.push(name)
        const refused = reply.status === 401 || reply.status === 403
        if (may && refused && !(name === 'getRecallTable' || name === 'getSkatingTable')) wrong.push(`${name} refused ${role}`)
        if (!may && !refused) wrong.push(`${name} let ${role} through (${reply.status})`)
      }
      expect(crashed).toEqual([])
      expect(wrong).toEqual([])
    })
  }
})

describe('what guests may not see', () => {
  it('hides club contact details', async () => {
    const guest = await app.ok<Array<{ contactEmail: string; name: string }>>('getClubs', [])
    expect(guest.length).toBeGreaterThan(0)
    expect(guest.every((c) => c.contactEmail === '' && c.name !== '')).toBe(true)
    const staff = await app.ok<Array<{ contactEmail: string }>>('getClubs', [], cookies.secretariat)
    expect(staff.every((c) => c.contactEmail !== '')).toBe(true)
  })

  it('refuses raw marks and payments', async () => {
    expect((await app.call('getMarks', ['x'])).status).toBe(401)
    expect((await app.call('getPaymentDetails', [])).status).toBe(401)
    expect((await app.call('getMarks', ['x'], cookies.adjudicator)).status).toBe(403)
  })

  it('does not let an adjudicator or club call staff functions', async () => {
    expect((await app.call('approveRound', ['x'], cookies.adjudicator)).status).toBe(403)
    expect((await app.call('approvePayment', ['x'], cookies.club)).status).toBe(403)
  })

  it('answers an unknown function with 404', async () => {
    expect((await app.call('dropEverything', [])).status).toBe(404)
  })
})
