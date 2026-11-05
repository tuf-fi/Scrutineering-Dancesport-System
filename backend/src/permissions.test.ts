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
  cookies.compere = await app.signIn.staff('compere')
  cookies.adjudicator = await app.signIn.adjudicator('410000')
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

const ROLES = ['none', Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson, Role.Compere, Role.Adjudicator] as const

describe('every function against every role', () => {
  // Calls each function with no arguments: it must be refused for the wrong role, and for the right
  // role fail with a message (never crash the server) because the arguments are missing.
  for (const role of ROLES) {
    it(`as ${role}`, async () => {
      const crashed: string[] = []
      const wrong: string[] = []
      for (const name of endpointNames()) {
        const rule = endpoint(name)!.access
        const may = rule === 'public' || (role !== 'none' && (rule === 'signedIn' || rule.includes(role as Role)))
        const reply = await app.call(name, [], role === 'none' ? undefined : cookies[role])
        if (reply.status === 500) crashed.push(name)
        // A role refusal, not a 403 the function itself gives (such as a wrong current password)
        const refused = (reply.status === 401 && reply.error === 'Sign in first.') || (reply.status === 403 && reply.error === 'Your account cannot do this.')
        if (may && refused && !(name === 'getRecallTable' || name === 'getSkatingTable')) wrong.push(`${name} refused ${role}`)
        if (!may && !refused) wrong.push(`${name} let ${role} through (${reply.status})`)
      }
      expect(crashed).toEqual([])
      expect(wrong).toEqual([])
    })
  }
})

describe('what guests may not see', () => {
  it('hides team contact details', async () => {
    const guest = await app.ok<Array<{ contactEmail: string; name: string }>>('getTeams', [])
    expect(guest.length).toBeGreaterThan(0)
    expect(guest.every((c) => c.contactEmail === '' && c.name !== '')).toBe(true)
    const staff = await app.ok<Array<{ contactEmail: string }>>('getTeams', [], cookies.secretariat)
    expect(staff.every((c) => c.contactEmail !== '')).toBe(true)
  })

  it('hides birth dates and contact details of competitors from everyone but admin and secretariat', async () => {
    const [team] = await app.ok<Array<{ id: string }>>('getTeams', [], cookies.secretariat)
    await app.ok('createCompetitor', [
      {
        names: ['Test Dancer'],
        teamId: team!.id,
        details: {
          province: 'Albay',
          coachId: null,
          dancers: [{ birthDate: '2012-03-04', address: '1 Rizal St', email: 'dancer@example.com', phone: '0917 555 0101' }],
          beginner: false,
          memberYear: null,
        },
      },
    ], cookies.secretariat)
    const withDetails = async (cookie?: string) =>
      (await app.ok<Array<{ details?: unknown }>>('getCompetitors', [], cookie)).filter((c) => c.details !== undefined).length
    expect(await withDetails()).toBe(0)
    expect(await withDetails(cookies.compere)).toBe(0)
    expect(await withDetails(cookies.scrutineer)).toBe(0)
    expect(await withDetails(cookies.secretariat)).toBeGreaterThan(0)
  })

  it('keeps the compere to announcements, and marks away from the admin', async () => {
    expect((await app.call('getEntryRows', [], cookies.compere)).status).toBe(403)
    expect((await app.call('getSubmissions', ['x'], cookies.compere)).status).toBe(403)
    expect((await app.call('getAnnouncements', [], cookies.compere)).status).toBe(200)
    expect((await app.call('getMarks', ['x'], cookies.admin)).status).toBe(403)
  })

  it('refuses raw marks and payments', async () => {
    expect((await app.call('getMarks', ['x'])).status).toBe(401)
    expect((await app.call('getPaymentDetails', [])).status).toBe(401)
    expect((await app.call('getMarks', ['x'], cookies.adjudicator)).status).toBe(403)
  })

  it('does not let an adjudicator call staff functions', async () => {
    expect((await app.call('approveRound', ['x'], cookies.adjudicator)).status).toBe(403)
    expect((await app.call('saveTeam', [{ name: 'X' }], cookies.adjudicator)).status).toBe(403)
  })

  it('answers an unknown function with 404', async () => {
    expect((await app.call('dropEverything', [])).status).toBe(404)
  })
})
