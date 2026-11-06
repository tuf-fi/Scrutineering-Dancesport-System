import { syllabusFor, type Competition, type Event } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from './testing.ts'

// An event can carry its own syllabus; without one, Juvenile up to Junior I show the standard text

let app: TestApp
let admin = ''
let competitionId = ''

beforeAll(async () => {
  app = await startTestApp()
  admin = await app.signIn.staff('admin')
  competitionId = (await app.ok<Competition[]>('getCompetitions', [], admin))[0]!.id
})
afterAll(() => app.close())

describe('event syllabus', () => {
  it('is kept with the event, trimmed, and cleared when emptied', async () => {
    const input = { number: 777, ageGroup: 'junior_1', class: 'D', discipline: 'latin', dances: ['samba'], isSolo: false }
    const made = await app.ok<Event>('saveEvent', [competitionId, { ...input, syllabus: '  Bronze figures only  ' }], admin)
    expect(made.syllabus).toBe('Bronze figures only')
    const cleared = await app.ok<Event>('saveEvent', [competitionId, { ...input, syllabus: '' }, made.id], admin)
    expect(cleared.syllabus).toBeUndefined()
  })

  it('falls back to the standard text only for Juvenile up to Junior I', () => {
    expect(syllabusFor({ ageGroup: 'junior_1' }, 'junior_1')).toMatch(/Lorem ipsum/)
    expect(syllabusFor({ ageGroup: 'junior_2' }, 'junior_2')).toBe('')
    expect(syllabusFor({ ageGroup: 'youth', syllabus: 'Own text' }, 'youth')).toBe('Own text')
  })
})
