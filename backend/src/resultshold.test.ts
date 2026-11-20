import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import { addTestData } from './db/testdata.ts'
import * as t from './db/schema.ts'
import { startTestApp, type TestApp } from './testing.ts'
import type { ResultsRelease } from '@bis/shared'

let app: TestApp
let admin: string
let scrutineer: string
const competitionId = 'td-past-1'
const eventId = 'td-past-1-e1'

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  for (const [id, role] of [['s-admin', 'admin'], ['s-scr', 'scrutineer']] as const) {
    app.db.insert(t.staffUsers).values({ id, name: role, username: `${role}@sample.example`, role, passwordHash: hashPassword(`pw-${role}`), disabled: false }).run()
  }
  addTestData(app.db)
  admin = await app.signIn.staff('admin', 'pw-admin')
  scrutineer = await app.signIn.staff('scrutineer', 'pw-scrutineer')
})
afterAll(() => app.close())

describe('holding results until the awarding', () => {
  it('shows published results to guests while nothing is held', async () => {
    expect((await app.ok<unknown[]>('getResults', [eventId])).length).toBeGreaterThan(0)
    expect(await app.ok<string[]>('getResultEventIds', [competitionId])).toContain(eventId)
  })

  it('hides the results and their ranking points from guests once the hold is on, but not from staff', async () => {
    app.db.update(t.competitions).set({ holdResults: true, resultsRevealedAt: null }).where(eq(t.competitions.id, competitionId)).run()
    expect(await app.ok<unknown[]>('getResults', [eventId])).toEqual([])
    expect(await app.ok<string[]>('getResultEventIds', [competitionId])).toEqual([])
    const guestPoints = await app.ok<Array<{ id: string }>>('getRankingPoints', [{}])
    expect(guestPoints.some((p) => p.id.startsWith(`${eventId}-p`))).toBe(false)
    expect((await app.ok<unknown[]>('getResults', [eventId], scrutineer)).length).toBeGreaterThan(0)
    const staffPoints = await app.ok<Array<{ id: string }>>('getRankingPoints', [{}], scrutineer)
    expect(staffPoints.some((p) => p.id.startsWith(`${eventId}-p`))).toBe(true)
  })

  it('keeps athletes whose only points are held off the public Bicol Athletes list', async () => {
    const before = await app.ok<string[]>('getBicolAthleteIds', [])
    app.db.update(t.competitions).set({ holdResults: true, resultsRevealedAt: null }).run()
    expect(await app.ok<string[]>('getBicolAthleteIds', [])).toEqual([])
    expect(before.length).toBeGreaterThan(0)
    const staff = await app.ok<string[]>('getBicolAthleteIds', [], scrutineer)
    expect(staff.length).toBe(before.length)
    app.db.update(t.competitions).set({ holdResults: false }).where(eq(t.competitions.id, 'td-past-2')).run()
    app.db.update(t.competitions).set({ holdResults: false }).where(eq(t.competitions.id, 'td-past-3')).run()
  })

  it('tells the scrutineer how many finals are waiting', async () => {
    const release = await app.ok<ResultsRelease>('getResultsRelease', [competitionId], scrutineer)
    expect(release).toMatchObject({ hold: true, revealedAt: null, waiting: 6, total: 6 })
  })

  it('only the scrutineer or chairperson can reveal', async () => {
    expect((await app.call('revealResults', [competitionId], admin)).status).toBe(403)
    expect((await app.call('revealResults', [competitionId])).status).toBe(401)
  })

  it('reveals every event at once, and only once', async () => {
    await app.ok('revealResults', [competitionId], scrutineer)
    expect((await app.ok<unknown[]>('getResults', [eventId])).length).toBeGreaterThan(0)
    expect(await app.ok<string[]>('getResultEventIds', [competitionId])).toContain(eventId)
    const guestPoints = await app.ok<Array<{ id: string }>>('getRankingPoints', [{}])
    expect(guestPoints.some((p) => p.id.startsWith(`${eventId}-p`))).toBe(true)
    expect((await app.call('revealResults', [competitionId], scrutineer)).status).toBe(409)
    expect((await app.ok<ResultsRelease>('getResultsRelease', [competitionId], scrutineer)).revealedAt).not.toBeNull()
  })

  it('refuses to reveal a competition that does not hold its results', async () => {
    expect((await app.call('revealResults', ['td-past-2'], scrutineer)).status).toBe(409)
  })

  it('the admin can switch the hold on when saving a competition', async () => {
    const saved = await app.ok<{ holdResults: boolean }>('saveCompetition', [{ name: 'Hold Open', date: '2999-01-01', venue: 'Gym', organizer: 'Org', image: 'data:image/png;base64,iVBORw0KGgo=', holdResults: true }], admin)
    expect(saved.holdResults).toBe(true)
  })
})
