import { listedInBicolAthletes, type Competition, type Event, type Team } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as t from './db/schema.ts'
import { startTestApp, type TestApp } from './testing.ts'

// The public Bicol Athletes list: a ranking entry in Juvenile, Junior or Youth; a Junior solo only for a female dancer

let app: TestApp
let competitionId = ''
let eventId = ''
let teamId = ''

beforeAll(async () => {
  app = await startTestApp()
  const admin = await app.signIn.staff('admin')
  competitionId = (await app.ok<Competition[]>('getCompetitions', [], admin))[0]!.id
  eventId = (await app.ok<Event[]>('getEvents', [competitionId], admin))[0]!.id
  teamId = (await app.ok<Team[]>('getTeams', [], admin))[0]!.id
})
afterAll(() => app.close())

const dancer = (gender: string) => ({ birthDate: '2012-01-01', gender, address: '', email: '', phone: '' })

function addEntry(id: string, names: string[], ageGroup: string, gender = '') {
  app.db
    .insert(t.competitors)
    .values({ id, names, ageGroup: null, birthDate: null, backNumber: null, teamId, details: { province: '', coachId: null, dancers: names.map(() => dancer(gender)), beginner: false, memberYear: null } } as typeof t.competitors.$inferInsert)
    .run()
  app.db.insert(t.rankingPoints).values({ id: `p-${id}`, competitorId: id, ageGroup, class: 'D', discipline: 'latin', competitionId, eventId, points: 5 }).run()
}

describe('who the Bicol Athletes list shows', () => {
  it('follows the rule for each age group, solo and couple', () => {
    expect(listedInBicolAthletes('juvenile_1', true, undefined)).toBe(true)
    expect(listedInBicolAthletes('youth', true, 'male')).toBe(true)
    expect(listedInBicolAthletes('junior_2', false, undefined)).toBe(true)
    expect(listedInBicolAthletes('junior_1', true, 'female')).toBe(true)
    expect(listedInBicolAthletes('junior_1', true, 'male')).toBe(false)
    expect(listedInBicolAthletes('junior_1', true, undefined)).toBe(false)
    expect(listedInBicolAthletes('adult', false, 'female')).toBe(false)
    expect(listedInBicolAthletes('senior', true, 'female')).toBe(false)
  })

  it('lists only competitors with a ranking entry in those groups, and keeps gender off the public data', async () => {
    addEntry('b-juv-solo', ['Ana'], 'juvenile_1')
    addEntry('b-jun-solo-f', ['Bea'], 'junior_1', 'female')
    addEntry('b-jun-solo-m', ['Carl'], 'junior_1', 'male')
    addEntry('b-jun-couple', ['Dan', 'Eve'], 'junior_2', 'male')
    addEntry('b-youth-solo', ['Fay'], 'youth', 'male')
    addEntry('b-adult', ['Gus'], 'adult', 'female')
    app.db.insert(t.competitors).values({ id: 'b-no-points', names: ['Hal'], ageGroup: null, birthDate: null, backNumber: null, teamId, details: null } as typeof t.competitors.$inferInsert).run()

    const ids = await app.ok<string[]>('getBicolAthleteIds', [])
    expect(ids.filter((id) => id.startsWith('b-')).sort()).toEqual(['b-jun-couple', 'b-jun-solo-f', 'b-juv-solo', 'b-youth-solo'])
    expect(JSON.stringify(await app.ok('getCompetitors', []))).not.toContain('gender')
  })
})
