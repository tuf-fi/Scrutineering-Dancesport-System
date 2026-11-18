import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from './testing.ts'

let app: TestApp
let admin: string
let scrutineer: string

const COMP = 'comp-sorsogon-2026'
const round = (n: number) => `${COMP}:e${n}:final`
const adjudicator = (letter: string) => (app.sqlite.prepare('SELECT id FROM adjudicators WHERE letter = ?').get(letter) as { id: string }).id
const onFloor = () => (app.sqlite.prepare('SELECT id FROM rounds WHERE on_floor_at IS NOT NULL ORDER BY id').all() as Array<{ id: string }>).map((r) => r.id)

beforeAll(async () => {
  app = await startTestApp()
  admin = await app.signIn.staff('admin')
  scrutineer = await app.signIn.staff('scrutineer')
  app.sqlite.exec("UPDATE rounds SET on_floor_at = NULL; UPDATE rounds SET status = 'pending' WHERE status = 'marking'; UPDATE payments SET status = 'approved'")
})
afterAll(() => app.close())

describe('rounds on the floor together', () => {
  it('starts two rounds whose adjudicators are different', async () => {
    await app.ok('setPanel', [`${COMP}:e1`, ['A', 'B', 'C'].map(adjudicator)], admin)
    await app.ok('setPanel', [`${COMP}:e3`, ['D', 'E', 'F'].map(adjudicator)], admin)
    await app.ok('startRound', [round(1)], scrutineer)
    await app.ok('startRound', [round(3)], scrutineer)
    expect(onFloor()).toEqual([round(1), round(3)])
    const rows = await app.ok<Array<{ roundId: string; onFloor: boolean }>>('getCompetitionRounds', [COMP], scrutineer)
    expect(rows.filter((r) => r.onFloor).map((r) => r.roundId).sort()).toEqual([round(1), round(3)])
    expect(await app.ok<string>('getCurrentRoundId', [COMP], scrutineer)).toBe(round(3))
  })

  it('refuses a round while one of its adjudicators is still marking another', async () => {
    await app.ok('setPanel', [`${COMP}:e17`, ['A', 'G'].map(adjudicator)], admin)
    const refused = await app.call('startRound', [round(17)], scrutineer)
    expect(refused.status).toBe(409)
    expect(refused.error).toBe('Adjudicator A is still marking E1 final. Wait until they finish, or take that round off the floor.')
    expect(onFloor()).toEqual([round(1), round(3)])
  })

  it('says who is busy and where', async () => {
    await app.ok('setPanel', [`${COMP}:e18`, ['B', 'D', 'H'].map(adjudicator)], admin)
    const refused = await app.call('startRound', [round(18)], scrutineer)
    expect(refused.error).toMatch(/^Adjudicator D is still marking E3 final/)
  })

  it('takes one round off the floor and leaves the other', async () => {
    await app.ok('clearFloor', [round(1)], scrutineer)
    expect(onFloor()).toEqual([round(3)])
    await app.ok('startRound', [round(17)], scrutineer)
    expect(onFloor()).toEqual([round(17), round(3)])
  })
})
