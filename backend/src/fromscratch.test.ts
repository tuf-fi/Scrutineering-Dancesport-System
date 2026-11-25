import { DEFAULT_MEMBERSHIP_FEES } from '@bis/shared'
import { priceSampleEvents } from './db/sample-fees.ts'
import { RoundType, type AdvancementRule, type HeatAssignment, type MarkSubmission, type RoundRow, type ScheduleItem } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { writePaymentSettings } from './paymentSettings.ts'
import { TEST_PHOTO, startTestApp, type TestApp } from './testing.ts'

// The whole competition from an empty database, in the order the people do it: admin sets up, secretariat registers,
// scrutineer sets the advancement table and plans, adjudicators mark, the scrutineer approves and publishes, the public reads.
// Three events: 7 couples (a final), 15 (round 1, semi-final, final) and 26 (round 1, round 2, semi-final, final).

let app: TestApp
const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
let admin = ''
let secretariat = ''
let scrutineer = ''
let competitionId = ''
const eventOf = new Map<number, string>()
const adjudicators: string[] = []
const phones = new Map<string, string>()

const FINAL = { type: RoundType.Final, recall: null }
const SEMI = { type: RoundType.SemiFinal, recall: 6 }
// The table as the screen builds it: a round's size is what the round before it recalled
const TABLE: AdvancementRule[] = [
  { from: 1, rounds: [FINAL] },
  { from: 8, rounds: [SEMI, FINAL] },
  { from: 15, rounds: [{ type: RoundType.Round1, recall: 9 }, SEMI, FINAL] },
  { from: 25, rounds: [{ type: RoundType.Round1, recall: 18 }, { type: RoundType.Round2, recall: 12 }, SEMI, FINAL] },
]

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  for (const [id, role] of [['staff-admin', 'admin'], ['staff-sec', 'secretariat'], ['staff-scr', 'scrutineer'], ['staff-chair', 'chairperson']] as const) {
    app.db.insert(t.staffUsers).values({ id, name: `${role} one`, username: `${role}@sample.example`, role, passwordHash: hashPassword('pw-' + role), disabled: false }).run()
  }
  writePaymentSettings(app.sqlite, { memberships: DEFAULT_MEMBERSHIP_FEES, methods: [] })
  admin = await app.signIn.staff('admin', 'pw-admin')
  secretariat = await app.signIn.staff('secretariat', 'pw-secretariat')
  scrutineer = await app.signIn.staff('scrutineer', 'pw-scrutineer')
}, 60_000)
afterAll(() => app.close())

describe('1. admin sets up', () => {
  it('creates the competition, the adjudicators and the events with panels', async () => {
    competitionId = (await app.ok<{ id: string }>('saveCompetition', [{ name: 'From Scratch Open', date: today, venue: 'Gym', organizer: 'Org', image: TEST_PHOTO }], admin)).id
    for (const letter of 'ABCDE') adjudicators.push((await app.ok<{ id: string }>('createAdjudicator', [{ name: `Adjudicator ${letter}`, letter, photo: TEST_PHOTO }], admin)).id)
    let number = 0
    for (const size of [7, 15, 26]) {
      number++
      const id = (await app.ok<{ id: string }>('saveEvent', [competitionId, { number, ageGroup: 'juvenile_1', class: 'E1', discipline: 'latin', dances: ['samba'], isSolo: true }], admin)).id
      priceSampleEvents(app.db)
      eventOf.set(size, id)
      await app.ok('setPanel', [id, adjudicators], admin)
    }
    expect(await app.ok<unknown[]>('getEvents', [competitionId])).toHaveLength(3)
  })

  it('only the admin sets up; the others are refused', async () => {
    expect((await app.call('saveCompetition', [{ name: 'X', date: today, venue: 'v', organizer: 'o', image: TEST_PHOTO }], scrutineer)).status).toBe(403)
    expect((await app.call('createAdjudicator', [{ name: 'X', letter: 'Z', photo: TEST_PHOTO }], secretariat)).status).toBe(403)
  })
})

describe('2. secretariat registers', () => {
  it('adds a team and enters every couple with a payment', async () => {
    const team = await app.ok<{ id: string }>('saveTeam', [{ name: 'Scratch Team', contactName: 'Coach', contactEmail: '', contactPhone: '' }], secretariat)
    const memberYear = Number(today.slice(0, 4))
    for (const [size, eventId] of eventOf) {
      for (let i = 1; i <= size; i++) {
        const dancer = await app.ok<{ id: string }>(
          'createCompetitor',
          [{ names: [`Dancer ${size}-${i}`], teamId: team.id, details: { province: '', coachId: null, dancers: [{ birthDate: '', address: '', email: '', phone: '' }], memberYear } }],
          secretariat,
        )
        await app.ok('registerCompetitor', [{ competitorId: dancer.id, eventIds: [eventId], method: 'gcash', reference: 'GC1234' }], secretariat)
      }
    }
    expect(app.sqlite.prepare("SELECT count(*) AS n FROM entries WHERE scratched = 0").get()).toEqual({ n: 48 })
    expect(app.sqlite.prepare("SELECT count(*) AS n FROM payments WHERE status = 'approved'").get()).toEqual({ n: 48 })
  })

  it('gives every competitor a back number', async () => {
    expect(await app.ok<number>('assignBackNumbers', [], secretariat)).toBe(48)
    expect(app.sqlite.prepare('SELECT count(DISTINCT back_number) AS n FROM competitors WHERE back_number IS NOT NULL').get()).toEqual({ n: 48 })
  })
})

describe('3. scrutineer sets the advancement table and plans', () => {
  it('suggests the default table to the secretariat before anything is saved', async () => {
    const schedule = await app.ok<ScheduleItem[]>('getSchedule', [competitionId], secretariat)
    const of = (size: number) => schedule.find((s) => s.eventId === eventOf.get(size))!.suggested.map((r) => r.type)
    expect(of(7)).toEqual(['final'])
    expect(of(15)).toEqual(['round_1', 'semi_final', 'final'])
  })

  it('saves a table with four early rounds and the event for 26 follows it', async () => {
    await app.ok('setAdvancementRules', [competitionId, TABLE], scrutineer)
    expect(await app.ok<AdvancementRule[]>('getAdvancementRules', [competitionId], scrutineer)).toEqual(TABLE)
    const schedule = await app.ok<ScheduleItem[]>('getSchedule', [competitionId], secretariat)
    expect(schedule.find((s) => s.eventId === eventOf.get(26))!.suggested).toEqual(TABLE[3]!.rounds)
  })

  it('plans the rounds from it', async () => {
    await app.ok('planRounds', [competitionId], scrutineer)
    const rounds = await app.ok<RoundRow[]>('getCompetitionRounds', [competitionId], scrutineer)
    const plan = (size: number) => rounds.filter((r) => r.eventId === eventOf.get(size)).map((r) => [r.type, r.recallNumber])
    expect(plan(7)).toEqual([['final', null]])
    expect(plan(15)).toEqual([['round_1', 9], ['semi_final', 6], ['final', null]])
    expect(plan(26)).toEqual([['round_1', 18], ['round_2', 12], ['semi_final', 6], ['final', null]])
  })

  it('splits the first round of the biggest event into heats', async () => {
    const rounds = await app.ok<RoundRow[]>('getCompetitionRounds', [competitionId], scrutineer)
    const first = rounds.find((r) => r.eventId === eventOf.get(26) && r.type === 'round_1')!
    const assignments = await app.ok<HeatAssignment[]>('getHeatAssignments', [first.roundId], scrutineer)
    expect(assignments.length).toBe(26)
    const split = assignments.map((a, i) => ({ competitorId: a.competitorId, heat: i < 13 ? 1 : 2 }))
    await app.ok('saveHeats', [first.roundId, split], scrutineer)
    const saved = await app.ok<HeatAssignment[]>('getHeatAssignments', [first.roundId], scrutineer)
    expect(new Set(saved.map((a) => a.heat))).toEqual(new Set([1, 2]))
  })
})

describe('4. the day', () => {
  it('admin makes the PINs and every adjudicator signs in', async () => {
    await app.ok('generatePins', [competitionId], admin)
    const pins = app.sqlite.prepare('SELECT adjudicator_id AS a, pin FROM adjudicator_pins WHERE competition_id = ?').all(competitionId) as Array<{ a: string; pin: string }>
    expect(pins).toHaveLength(5)
    for (const p of pins) phones.set(p.a, await app.signIn.adjudicator(p.pin))
  })

  it('the secretariat cannot start a round', async () => {
    const rounds = await app.ok<RoundRow[]>('getCompetitionRounds', [competitionId], scrutineer)
    expect((await app.call('startRound', [rounds[0]!.roundId], secretariat)).status).toBe(403)
  })

  it('runs every round to a published result, each round the size the table says', async () => {
    const sizes: Record<string, number> = {}
    for (let pass = 0; pass < 8; pass++) {
      const rounds = await app.ok<RoundRow[]>('getCompetitionRounds', [competitionId], scrutineer)
      const waiting = rounds.filter((r) => r.status === 'pending')
      if (waiting.length === 0) break
      let moved = 0
      for (const round of waiting) {
        const started = await app.call('startRound', [round.roundId], scrutineer)
        if (started.status !== 200) {
          expect(started.error).toMatch(/previous round/)
          continue
        }
        for (const adjudicator of adjudicators) {
          const phone = phones.get(adjudicator)!
          const state = await app.ok<{ task: { recallNumber: number | null; dances: string[]; competitors: Array<{ id: string; backNumber: number | null }> } }>('getAdjudicatorState', [], phone)
          const ordered = [...state.task.competitors].sort((a, b) => (a.backNumber ?? 0) - (b.backNumber ?? 0)).map((c) => c.id)
          sizes[round.roundId] = ordered.length
          const chosen = state.task.recallNumber === null ? ordered : ordered.slice(0, state.task.recallNumber)
          await app.ok('submitAdjudicatorMarks', [round.roundId, state.task.dances.map((dance) => ({ dance: dance as MarkSubmission['dance'], competitorIds: chosen }))], phone)
        }
        await app.ok('approveRound', [round.roundId], scrutineer)
        await app.ok('publishRound', [round.roundId], scrutineer)
        moved++
      }
      expect(moved).toBeGreaterThan(0)
    }
    const rounds = await app.ok<RoundRow[]>('getCompetitionRounds', [competitionId], scrutineer)
    expect(rounds.filter((r) => r.status === 'pending')).toEqual([])
    // Each round danced the number the one before it recalled; the first danced everyone entered
    const of = (size: number) => rounds.filter((r) => r.eventId === eventOf.get(size))
    const danced = (size: number) => of(size).map((r) => sizes[r.roundId])
    expect(danced(7)).toEqual([7])
    expect(danced(15)).toEqual([15, 9, 6])
    expect(danced(26)).toEqual([26, 18, 12, 6])
  }, 120_000)
})

describe('5. results', () => {
  it('every event has a winner and places counting up from 1', async () => {
    for (const eventId of eventOf.values()) {
      const results = await app.ok<Array<{ place: number }>>('getResults', [eventId])
      expect(results.length).toBeGreaterThan(0)
      expect(results.filter((r) => r.place === 1)).toHaveLength(1)
    }
  })

  it('finalists are the lowest back numbers (all adjudicators marked alike)', async () => {
    for (const [size, eventId] of eventOf) {
      const rows = app.sqlite
        .prepare('SELECT r.place, c.back_number AS b FROM results r JOIN competitors c ON c.id = r.competitor_id WHERE r.event_id = ? ORDER BY r.place')
        .all(eventId) as Array<{ place: number; b: number }>
      const all = app.sqlite.prepare('SELECT c.back_number AS b FROM entries e JOIN competitors c ON c.id = e.competitor_id WHERE e.event_id = ? ORDER BY c.back_number').all(eventId) as Array<{ b: number }>
      const finalists = Math.min(size, size >= 8 ? 6 : size)
      expect(rows.filter((r) => r.place <= finalists).map((r) => r.b)).toEqual(all.slice(0, finalists).map((r) => r.b))
    }
  })

  it('awards ranking points, records every step and keeps the database sound', async () => {
    expect((await app.ok<unknown[]>('getRankingPoints', [{}])).length).toBeGreaterThan(0)
    expect((app.sqlite.prepare("SELECT count(*) AS n FROM audit_log WHERE action = 'Published round'").get() as { n: number }).n).toBe(
      (app.sqlite.prepare('SELECT count(*) AS n FROM rounds').get() as { n: number }).n,
    )
    expect(app.sqlite.pragma('foreign_key_check')).toEqual([])
    expect(app.sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
  })
})
