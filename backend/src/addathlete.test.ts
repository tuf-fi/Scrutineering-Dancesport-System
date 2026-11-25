import type { AthleteRecord, AthleteRow, CompetitorDetails, CompetitorRow, Team } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from './testing.ts'

// One form adds the athlete for the list and the competitor for the events

let app: TestApp
let secretariat = ''
let compere = ''
let teamId = ''

const dancer = { birthDate: '2012-01-01', gender: '' as const, address: 'Naga City', email: 'dancer@test.example', phone: '09171234567' }
const details = (extra: Partial<CompetitorDetails> = {}): CompetitorDetails => ({ province: 'Albay', coachId: null, dancers: [dancer, dancer], memberYear: null, memberMonth: null, ...extra })

beforeAll(async () => {
  app = await startTestApp()
  secretariat = await app.signIn.staff('secretariat')
  compere = await app.signIn.staff('compere')
  teamId = (await app.ok<Team[]>('getTeams', [], secretariat))[0]!.id
})
afterAll(() => app.close())

const records = () => app.ok<AthleteRecord[]>('getAthleteRecords', [], secretariat)

describe('adding an athlete', () => {
  it('makes the athlete and the competitor together, with no membership or membership ID', async () => {
    const before = (await records()).length
    const row = await app.ok<CompetitorRow>('addAthlete', [{ names: ['Zed Alpha'], teamId, details: details({ memberYear: 2026, memberMonth: 1 }) }], secretariat)
    expect(row.names).toEqual(['Zed Alpha'])
    const added = (await records()).find((r) => r.name === 'Zed Alpha')
    expect(added).toMatchObject({ teamId, province: 'Albay', birthDate: '2012-01-01', phone: '09171234567', memberYear: null, membershipId: null })
    expect((await records()).length).toBe(before + 1)
    expect((await app.ok<CompetitorRow[]>('getCompetitorRows', [], secretariat)).some((c) => c.id === row.id)).toBe(true)
  })

  it('adds the first dancer of a couple to the list, and the couple as one competitor', async () => {
    const before = (await records()).length
    const row = await app.ok<CompetitorRow>('addAthlete', [{ names: ['Pat Beta', 'Quin Gamma'], teamId, details: details() }], secretariat)
    expect(row.names).toEqual(['Pat Beta', 'Quin Gamma'])
    expect((await records()).map((r) => r.name)).toContain('Pat Beta')
    expect((await records()).length).toBe(before + 1)
  })

  it('does not add a second person for a name that is already an athlete', async () => {
    const account = (await app.ok<AthleteRow[]>('getAthletes', [], secretariat))[0]!
    const before = (await records()).length
    await app.ok('addAthlete', [{ names: [account.name], teamId, details: details() }], secretariat)
    expect((await records()).length).toBe(before)
  })

  it('refuses the same dancers twice on a team, a team that is missing, and the wrong role', async () => {
    expect((await app.call('addAthlete', [{ names: ['Zed Alpha'], teamId, details: details() }], secretariat)).status).toBe(409)
    expect((await app.call('addAthlete', [{ names: ['Nobody Here'], teamId: 'no-such-team', details: details() }], secretariat)).error).toMatch(/Team/)
    expect((await app.call('addAthlete', [{ names: ['Rae Delta'], teamId, details: details() }], compere)).status).toBe(403)
    // Nothing was left behind by the refused ones
    expect((await records()).some((r) => r.name === 'Nobody Here' || r.name === 'Rae Delta')).toBe(false)
  })
})
