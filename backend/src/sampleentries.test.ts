import type { EntryRequest, MemberRoster } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as t from './db/schema.ts'
import { addSampleAthleteData, addSampleCompetitorData, addSampleEntryData, addSampleUpcoming } from './db/seed.ts'
import { startTestApp, type TestApp } from './testing.ts'

// The sample data for coaches, teams and entry requests, as the seed command adds it

let app: TestApp

beforeAll(async () => {
  app = await startTestApp()
  addSampleUpcoming(app.db)
  addSampleAthleteData(app.db)
  addSampleCompetitorData(app.db)
  addSampleEntryData(app.db)
})
afterAll(() => app.close())

describe('sample entries', () => {
  it('gives the coming competitions solo events', () => {
    const solos = app.db.select().from(t.events).all().filter((e) => e.competitionId === 'comp-bicol-2026' && e.isSolo)
    expect(solos).toHaveLength(18)
  })

  it('links the sample team and coach, so their pages have dancers', async () => {
    const team = await app.signIn.member('team', 'team@sample.example', 'bis2026')
    const coach = await app.signIn.member('coach', 'coach@sample.example', 'bis2026')
    expect((await app.ok<MemberRoster>('getMyRoster', [], team)).rows.length).toBeGreaterThan(1)
    expect((await app.ok<MemberRoster>('getMyRoster', [], coach)).rows.length).toBeGreaterThan(0)
  })

  it('has entry requests in every state, all sent by teams', async () => {
    const secretariat = await app.signIn.staff('secretariat')
    const all = await app.ok<EntryRequest[]>('getEntryRequests', [], secretariat)
    expect(all.map((r) => r.status).sort()).toEqual(['approved', 'rejected', 'waiting'])
    expect(all.filter((r) => r.status === 'waiting').map((r) => r.requesterRole).sort()).toEqual(['team'])
  })

  it('can be added again without doubling anything', () => {
    const before = app.db.select().from(t.entryRequests).all().length
    addSampleEntryData(app.db)
    expect(app.db.select().from(t.entryRequests).all()).toHaveLength(before)
    expect(app.db.select().from(t.events).all().filter((e) => e.competitionId === 'comp-bicol-2026' && e.isSolo)).toHaveLength(18)
  })
})
