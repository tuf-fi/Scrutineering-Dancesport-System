import type { AdvancementRule, ScheduleItem } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { writePaymentSettings } from './paymentSettings.ts'
import { startTestApp, type TestApp } from './testing.ts'

// The scrutineer's table of how many couples go through each round

let app: TestApp
const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
let admin = ''
let scrutineer = ''
let secretariat = ''
let competitionId = ''
const eventOf = new Map<number, string>()

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  for (const [id, role] of [['staff-admin', 'admin'], ['staff-sec', 'secretariat'], ['staff-scr', 'scrutineer']] as const) {
    app.db.insert(t.staffUsers).values({ id, name: `${role} one`, username: `${role}@sample.example`, role, passwordHash: hashPassword('pw-' + role), disabled: false }).run()
  }
  writePaymentSettings(app.sqlite, { fees: { solo: 500, couple: 800 }, methods: [] })
  admin = await app.signIn.staff('admin', 'pw-admin')
  secretariat = await app.signIn.staff('secretariat', 'pw-secretariat')
  scrutineer = await app.signIn.staff('scrutineer', 'pw-scrutineer')
  competitionId = (await app.ok<{ id: string }>('saveCompetition', [{ name: 'Table Open', date: today, venue: 'Gym', organizer: 'Org', image: 'data:image/png;base64,iVBORw0KGgo=' }], admin)).id
  const team = await app.ok<{ id: string }>('saveTeam', [{ name: 'Test Team', contactName: 'Coach', contactEmail: '', contactPhone: '' }], secretariat)
  let number = 0
  for (const size of [7, 15, 17]) {
    number++
    const eventId = (await app.ok<{ id: string }>('saveEvent', [competitionId, { number, ageGroup: 'juvenile_1', class: 'E1', discipline: 'latin', dances: ['samba'], isSolo: true }], admin)).id
    eventOf.set(size, eventId)
    for (let i = 1; i <= size; i++) {
      const dancer = await app.ok<{ id: string }>(
        'createCompetitor',
        [{ names: [`Dancer ${size}-${i}`], teamId: team.id, details: { province: '', coachId: null, dancers: [{ birthDate: '', address: '', email: '', phone: '' }], memberYear: Number(today.slice(0, 4)) } }],
        secretariat,
      )
      await app.ok('registerCompetitor', [{ competitorId: dancer.id, eventIds: [eventId], method: 'gcash', reference: 'GC1234' }], secretariat)
    }
  }
}, 120_000)
afterAll(() => app.close())

const plan = async (size: number) => {
  const rounds = await app.ok<Array<{ eventId: string; type: string; recallNumber: number | null }>>('getCompetitionRounds', [competitionId], scrutineer)
  return rounds.filter((r) => r.eventId === eventOf.get(size)).map((r) => ({ type: r.type, recall: r.recallNumber }))
}

const FINAL = { type: 'final', recall: null }
const SEMI = { type: 'semi_final', recall: 6 }

describe('advancement table', () => {
  it('gives the default until one is saved, and suggests it in the schedule', async () => {
    const rules = await app.ok<AdvancementRule[]>('getAdvancementRules', [competitionId], secretariat)
    expect(rules.map((r) => r.from)).toEqual([1, 8, 15, 17, 25])
    const schedule = await app.ok<ScheduleItem[]>('getSchedule', [competitionId], secretariat)
    const suggested = (size: number) => schedule.find((s) => s.eventId === eventOf.get(size))!.suggested
    expect(suggested(7)).toEqual([FINAL])
    expect(suggested(15)).toEqual([{ type: 'round_1', recall: 9 }, SEMI, FINAL])
    expect(suggested(17)[0]).toEqual({ type: 'round_1', recall: 12 })
  })

  it('only the scrutineer saves the table', async () => {
    const rules = [{ from: 1, rounds: [FINAL] }]
    for (const token of [admin, secretariat]) expect((await app.call('setAdvancementRules', [competitionId, rules], token)).status).toBe(403)
    expect((await app.call('setAdvancementRules', [competitionId, rules], 'nobody')).status).toBe(401)
  })

  it('refuses a table that makes no sense', async () => {
    const bad: unknown[] = [
      [],
      [{ from: 2, rounds: [FINAL] }],
      [{ from: 1, rounds: [FINAL] }, { from: 1, rounds: [FINAL] }],
      [{ from: 1, rounds: [FINAL] }, { from: 10, rounds: [{ type: 'semi_final', recall: 10 }, FINAL] }],
      [{ from: 1, rounds: [SEMI] }],
    ]
    for (const rules of bad) expect((await app.call('setAdvancementRules', [competitionId, rules], scrutineer)).status).toBe(400)
  })

  it('plans the rounds from the saved table', async () => {
    await app.ok('setAdvancementRules', [competitionId, [
      { from: 1, rounds: [FINAL] },
      { from: 8, rounds: [SEMI, FINAL] },
      { from: 15, rounds: [{ type: 'round_1', recall: 9 }, SEMI, FINAL] },
      { from: 17, rounds: [{ type: 'round_1', recall: 12 }, SEMI, FINAL] },
    ]], scrutineer)
    expect(await app.ok('getAdvancementRules', [competitionId], secretariat)).toHaveLength(4)
    await app.ok('planRounds', [competitionId], scrutineer)
    expect(await plan(7)).toEqual([FINAL])
    expect(await plan(15)).toEqual([{ type: 'round_1', recall: 9 }, SEMI, FINAL])
    expect(await plan(17)).toEqual([{ type: 'round_1', recall: 12 }, SEMI, FINAL])
  })

  it('leaves events that already have rounds alone when the table changes', async () => {
    await app.ok('setAdvancementRules', [competitionId, [{ from: 1, rounds: [FINAL] }]], scrutineer)
    expect(await plan(17)).toHaveLength(3)
  })
})
