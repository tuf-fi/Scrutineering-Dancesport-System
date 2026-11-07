import type { Competition, DeleteImpact, Event } from '@bis/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as t from './db/schema.ts'
import { startTestApp, type TestApp } from './testing.ts'

// Deleting a record that has related data: the preview lists it, the delete needs a yes, and then it all goes

let app: TestApp
let admin = ''
let secretariat = ''
let competitionId = ''
const eventInput = { number: 950, ageGroup: 'adult', class: 'D', discipline: 'latin', dances: ['samba'], isSolo: false }

beforeAll(async () => {
  app = await startTestApp()
  admin = await app.signIn.staff('admin')
  secretariat = await app.signIn.staff('secretariat')
  competitionId = (await app.ok<Competition[]>('getCompetitions', [], admin))[0]!.id
})
afterAll(() => app.close())

describe('deleting with related data', () => {
  it('lists scratched entries and rounds, refuses without a yes, then removes them and keeps the competitor', async () => {
    const event = await app.ok<Event>('saveEvent', [competitionId, eventInput], secretariat)
    const competitor = app.db.select().from(t.competitors).get()!
    app.db.insert(t.entries).values({ id: 'cascade-entry', eventId: event.id, competitorId: competitor.id, scratched: true }).run()
    app.db.insert(t.rounds).values({ id: 'cascade-round', eventId: event.id, type: 'final', position: 1, recallNumber: null, status: 'pending' }).run()

    const impact = await app.ok<DeleteImpact>('getDeleteImpact', ['event', event.id], secretariat)
    expect(impact.items.map((i) => i.label)).toEqual(['Entries (1 scratched)', 'Rounds'])

    const refusal = await app.call('deleteEvent', [event.id], secretariat)
    expect(refusal.status).toBe(409)
    expect(refusal.error).toMatch(/related data/)

    await app.ok('deleteEvent', [event.id, true], secretariat)
    expect(app.db.select().from(t.events).where(eq(t.events.id, event.id)).get()).toBeUndefined()
    expect(app.db.select().from(t.entries).where(eq(t.entries.id, 'cascade-entry')).get()).toBeUndefined()
    expect(app.db.select().from(t.rounds).where(eq(t.rounds.id, 'cascade-round')).get()).toBeUndefined()
    expect(app.db.select().from(t.competitors).where(eq(t.competitors.id, competitor.id)).get()).toBeDefined()
  })

  it('deletes an event with nothing attached without a yes', async () => {
    const event = await app.ok<Event>('saveEvent', [competitionId, { ...eventInput, number: 951 }], secretariat)
    expect((await app.ok<DeleteImpact>('getDeleteImpact', ['event', event.id], secretariat)).items).toEqual([])
    await app.ok('deleteEvent', [event.id], secretariat)
  })

  it('only lets the admin preview an admin-only delete', async () => {
    expect((await app.call('getDeleteImpact', ['competition', competitionId], secretariat)).status).toBe(403)
  })
})
