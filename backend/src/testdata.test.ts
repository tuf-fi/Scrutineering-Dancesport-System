import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { addTestData } from './db/testdata.ts'
import { startTestApp, type TestApp } from './testing.ts'

// The test data fills every list with believable rows, and loading it twice adds nothing more

let app: TestApp

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  app.db.insert(t.staffUsers).values({ id: 's1', name: 'admin', username: 'admin@sample.example', role: 'admin', passwordHash: hashPassword('pw-admin'), disabled: false }).run()
})
afterAll(() => app.close())


describe('test data', () => {
  it('adds the teams, coaches, athletes, adjudicators and competitions, each with what it needs', () => {
    const report = addTestData(app.db)
    expect(report).toMatchObject({ teams: 5, coaches: 5, athletes: 20, adjudicators: 10, adjudicatorsSkipped: 5, pastCompetitions: 3, upcomingCompetitions: 5 })

    expect(app.db.select().from(t.teams).all()).toHaveLength(5)
    expect(app.db.select().from(t.coaches).all()).toHaveLength(5)
    const athletes = app.db.select().from(t.athletes).all()
    expect(athletes).toHaveLength(20)
    expect(athletes.every((a) => a.photo?.startsWith('data:image/png;base64,'))).toBe(true)
    expect(app.db.select().from(t.competitors).all()).toHaveLength(20)

    const adjudicators = app.db.select().from(t.adjudicators).all()
    expect(adjudicators.map((a) => a.letter).sort().join('')).toBe('ABCDEFGHIJ')
    expect(adjudicators.every((a) => a.photo)).toBe(true)

    const competitions = app.db.select().from(t.competitions).all()
    expect(competitions).toHaveLength(8)
    expect(competitions.every((c) => c.image)).toBe(true)
    const events = app.db.select().from(t.events).all()
    expect(events).toHaveLength(8 * 6)
    // Only the finished competitions have results
    const finished = new Set(competitions.filter((c) => c.date < '2026-11-05').map((c) => c.id))
    expect(finished.size).toBe(3)
    const resultEvents = new Set(app.db.select().from(t.results).all().map((r) => r.eventId))
    expect([...resultEvents].every((id) => finished.has(events.find((e) => e.id === id)!.competitionId))).toBe(true)
    expect(resultEvents.size).toBe(3 * 6)
  })

  it('adds nothing the second time', () => {
    addTestData(app.db)
    expect(app.db.select().from(t.athletes).all()).toHaveLength(20)
    expect(app.db.select().from(t.competitions).all()).toHaveLength(8)
    expect(app.db.select().from(t.adjudicators).all()).toHaveLength(10)
    expect(app.db.select().from(t.entries).all()).toHaveLength(8 * 6 * 5)
  })
})
