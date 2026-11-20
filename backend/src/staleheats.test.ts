import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import { addFloorDemo } from './db/demofloor.ts'
import * as t from './db/schema.ts'
import { reconcileHeats } from './services/shared.ts'
import { startTestApp, type TestApp } from './testing.ts'

let app: TestApp
let scrutineer: string
const round = 'td-floor-demo-e1-final'

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  app.db.insert(t.staffUsers).values({ id: 's1', name: 'Scrutineer', username: 'scrutineer@sample.example', role: 'scrutineer', passwordHash: hashPassword('pw-scrutineer'), disabled: false }).run()
  for (const letter of 'ABCDEFGHI') app.db.insert(t.adjudicators).values({ id: `adj-${letter}`, name: `Adjudicator ${letter}`, letter }).run()
  addFloorDemo(app.db)
  scrutineer = await app.signIn.staff('scrutineer', 'pw-scrutineer')
})
afterAll(() => app.close())

describe('reconcileHeats', () => {
  it('drops who left and puts who is new in the smallest heat', () => {
    expect(reconcileHeats([['a', 'b'], ['c']], ['a', 'c', 'd', 'e'])).toEqual([['a', 'd'], ['c', 'e']])
    expect(reconcileHeats([['a'], ['b']], ['a'])).toEqual([['a']])
  })
})

describe('heats saved before more dancers were entered', () => {
  it('still list everyone in the round, and start with everyone', async () => {
    app.db.insert(t.heats).values({ id: 'stale-1', roundId: round, number: 1 }).run()
    app.db.insert(t.heats).values({ id: 'stale-2', roundId: round, number: 2 }).run()
    app.db.insert(t.heatCompetitors).values({ heatId: 'stale-1', competitorId: 'td-floor-competitor-1' }).run()
    app.db.insert(t.heatCompetitors).values({ heatId: 'stale-2', competitorId: 'td-floor-competitor-2' }).run()

    const shown = await app.ok<Array<{ competitorId: string; heat: number }>>('getHeatAssignments', [round], scrutineer)
    expect(shown).toHaveLength(6)
    expect(new Set(shown.map((s) => s.heat))).toEqual(new Set([1, 2]))

    app.sqlite.prepare("update entries set scratched = 1 where event_id = 'td-floor-demo-e1' and competitor_id = 'td-floor-competitor-6'").run()
    expect(await app.ok<unknown[]>('getHeatAssignments', [round], scrutineer)).toHaveLength(5)

    await app.ok('startRound', [round], scrutineer)
    const saved = app.sqlite.prepare('select count(*) as n from heat_competitors hc join heats h on h.id = hc.heat_id where h.round_id = ?').get(round) as { n: number }
    expect(saved.n).toBe(5)
  })
})
