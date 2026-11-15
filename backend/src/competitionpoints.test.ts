import type { Event, RankingPoint } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from './testing.ts'

// An event can opt out of ranking points: its results stay, but they award none

let app: TestApp
let admin = ''

beforeAll(async () => {
  app = await startTestApp()
  admin = await app.signIn.staff('admin')
})
afterAll(() => app.close())

const points = () => app.ok<RankingPoint[]>('getRankingPoints', [{}], admin)

describe('ranking events', () => {
  it('counts towards the rankings unless told otherwise, and a bad value is refused', async () => {
    const row = app.sqlite.prepare('SELECT event_id AS id FROM ranking_points LIMIT 1').get() as { id: string }
    const event = await app.ok<Event>('getEvent', [row.id], admin)
    expect(event.usesPoints).toBe(true)
    const { id, competitionId, ...input } = event
    expect((await app.call('saveEvent', [competitionId, { ...input, usesPoints: 'no' }, id], admin)).error).toMatch(/ranking event/)
    // An edit that does not send it keeps it
    const { usesPoints, ...rest } = input
    expect(usesPoints).toBe(true)
    expect((await app.ok<Event>('saveEvent', [competitionId, rest, id], admin)).usesPoints).toBe(true)
  })

  it('removes the points of an event turned off, even after it has results, and awards them again when turned on', async () => {
    const row = app.sqlite.prepare('SELECT event_id AS id FROM ranking_points LIMIT 1').get() as { id: string }
    const event = await app.ok<Event>('getEvent', [row.id], admin)
    const { id, competitionId, ...input } = event
    const count = () => (app.sqlite.prepare('SELECT COUNT(*) AS n FROM ranking_points WHERE event_id = ?').get(row.id) as { n: number }).n
    expect(count()).toBeGreaterThan(0)

    await app.ok('saveEvent', [competitionId, { ...input, usesPoints: false }, id], admin)
    expect(count()).toBe(0)
    expect((await points()).length).toBeGreaterThan(0)

    await app.ok('saveEvent', [competitionId, { ...input, usesPoints: true }, id], admin)
    expect(count()).toBeGreaterThan(0)
  })
})
