import type { Competition, RankingPoint } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from './testing.ts'

// A competition can opt out of ranking points: its results stay, but they award none

let app: TestApp
let admin = ''
const SHOT = 'data:image/png;base64,iVBORw0KGgo='
const base = { name: 'No Points Cup', date: '2099-06-01', venue: 'Gym', organizer: 'Org', image: SHOT }

beforeAll(async () => {
  app = await startTestApp()
  admin = await app.signIn.staff('admin')
})
afterAll(() => app.close())

describe('competition points', () => {
  it('uses points unless told otherwise, and a bad value is refused', async () => {
    const made = await app.ok<Competition>('saveCompetition', [base], admin)
    expect(made.usesPoints).toBe(true)
    const off = await app.ok<Competition>('saveCompetition', [{ ...base, name: 'Friendly', usesPoints: false }], admin)
    expect(off.usesPoints).toBe(false)
    expect((await app.call('saveCompetition', [{ ...base, name: 'Odd', usesPoints: 'no' }], admin)).error).toMatch(/uses points/)
    // An edit that does not send it keeps it
    expect((await app.ok<Competition>('saveCompetition', [{ ...base, name: 'Friendly', venue: 'Hall' }, off.id], admin)).usesPoints).toBe(false)
  })

  it('removes the points of a competition turned off, and awards them again when turned on', async () => {
    const points = () => app.ok<RankingPoint[]>('getRankingPoints', [{}], admin)
    const earned = (await points()).filter((p) => p.competitionId !== undefined)
    const target = earned[0]!.competitionId
    const own = () => points().then((all) => all.filter((p) => p.competitionId === target))
    const before = (await own()).length
    expect(before).toBeGreaterThan(0)

    const competition = (await app.ok<Competition[]>('getCompetitions', [], admin)).find((c) => c.id === target)!
    const { id, ...rest } = competition
    await app.ok('saveCompetition', [{ ...rest, usesPoints: false }, id], admin)
    expect(await own()).toHaveLength(0)
    expect((await points()).length).toBeGreaterThan(0)

    await app.ok('saveCompetition', [{ ...rest, usesPoints: true }, id], admin)
    expect((await own()).length).toBeGreaterThan(0)
  })
})
