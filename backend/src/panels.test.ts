import type { Adjudicator, Competition, Event, Panel, PanelsResult } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from './testing.ts'

// One list of adjudicators for many events, by the secretariat or the scrutineer

let app: TestApp
const who: Record<string, string> = {}
let competitionId = ''
let events: Event[] = []
let adjudicators: Adjudicator[] = []

beforeAll(async () => {
  app = await startTestApp()
  for (const role of ['admin', 'secretariat', 'scrutineer', 'chairperson', 'compere']) who[role] = await app.signIn.staff(role)
  const competition = (await app.ok<Competition[]>('getCompetitions', [], who.admin)).find((c) => c.name.includes('Bicol')) ?? (await app.ok<Competition[]>('getCompetitions', [], who.admin))[0]!
  competitionId = competition.id
  events = (await app.ok<Event[]>('getEvents', [competitionId], who.admin)).slice(0, 3)
  adjudicators = await app.ok<Adjudicator[]>('getAdjudicators', [], who.admin)
  expect(events.length).toBe(3)
  expect(adjudicators.length).toBeGreaterThan(2)
})
afterAll(() => app.close())

const panelOf = async (eventId: string) => (await app.ok<Panel | null>('getPanel', [eventId], who.admin))?.adjudicatorIds ?? []
const ids = (n: number) => adjudicators.slice(0, n).map((a) => a.id)
const eventIds = () => events.map((e) => e.id)

describe('setting panels for many events', () => {
  it('replaces every panel with one list, for the secretariat and the scrutineer', async () => {
    const result = await app.ok<PanelsResult>('setPanels', [competitionId, eventIds(), ids(2), 'replace'], who.secretariat)
    expect(result).toEqual({ changed: eventIds(), skipped: [] })
    for (const id of eventIds()) expect([...(await panelOf(id))].sort()).toEqual([...ids(2)].sort())
    await app.ok('setPanels', [competitionId, eventIds(), ids(3), 'replace'], who.scrutineer)
    expect((await panelOf(events[0]!.id)).length).toBe(3)
  })

  it('adds to what is there without dropping anyone', async () => {
    await app.ok('setPanels', [competitionId, [events[0]!.id], ids(1), 'replace'], who.admin)
    await app.ok('setPanels', [competitionId, [events[0]!.id], [adjudicators[2]!.id], 'add'], who.admin)
    expect([...(await panelOf(events[0]!.id))].sort()).toEqual([adjudicators[0]!.id, adjudicators[2]!.id].sort())
  })

  it('leaves an event that has started with its panel and says so', async () => {
    const started = events[1]!
    const before = await panelOf(started.id)
    app.sqlite.prepare("INSERT OR IGNORE INTO rounds (id, event_id, type, position, status) VALUES ('panel-test-round', ?, 'final', 1, 'pending')").run(started.id)
    app.sqlite.prepare("UPDATE rounds SET status = 'marking' WHERE event_id = ?").run(started.id)
    const result = await app.ok<PanelsResult>('setPanels', [competitionId, eventIds(), ids(1), 'replace'], who.admin)
    expect(result.skipped).toEqual([started.id])
    expect(result.changed).toEqual(eventIds().filter((id) => id !== started.id))
    expect(await panelOf(started.id)).toEqual(before)
  })

  it('refuses nobody chosen, a bad mode, no events, and the wrong role', async () => {
    expect((await app.call('setPanels', [competitionId, eventIds(), [], 'replace'], who.admin)).error).toMatch(/at least one adjudicator/)
    expect((await app.call('setPanels', [competitionId, eventIds(), ids(1), 'merge'], who.admin)).error).toMatch(/replace the panels or add/)
    expect((await app.call('setPanels', [competitionId, [], ids(1), 'replace'], who.admin)).error).toMatch(/at least one event/)
    expect((await app.call('setPanels', [competitionId, eventIds(), ids(1), 'replace'], who.compere)).status).toBe(403)
    expect((await app.call('setPanels', [competitionId, eventIds(), ids(1), 'replace'], who.chairperson)).status).toBe(200)
  })
})
