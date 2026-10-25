import type { CompetitorHistoryLine, Result } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from './testing.ts'

let app: TestApp
beforeAll(async () => {
  app = await startTestApp()
})
afterAll(() => app.close())

describe('a tie in a final', () => {
  // The sample has none, so the 2nd place of one final becomes a tie for 2nd to 3rd
  let tied: { eventId: string; competitorId: string }
  beforeAll(() => {
    const row = app.sqlite.prepare("select id, event_id as eventId, competitor_id as competitorId from results where stage = 'final' and place = 2 limit 1").get() as { id: string; eventId: string; competitorId: string }
    app.sqlite.prepare('update results set place_from = 2, place_to = 3 where id = ?').run(row.id)
    tied = row
  })

  it('keeps its whole range with the result, as well as the best place', async () => {
    const results = await app.ok<Result[]>('getResults', [tied.eventId])
    expect(results.find((r) => r.competitorId === tied.competitorId)).toMatchObject({ place: 2, placeFrom: 2, placeTo: 3 })
  })

  it('shows the range in the competitor history too', async () => {
    const history = await app.ok<CompetitorHistoryLine[]>('getCompetitorHistory', [tied.competitorId])
    expect(history.some((h) => h.place === 2 && h.placeFrom === 2 && h.placeTo === 3)).toBe(true)
  })
})
