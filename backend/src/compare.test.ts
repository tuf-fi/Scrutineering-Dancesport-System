import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { compareResults } from './compare.ts'
import { startTestApp, type TestApp } from './testing.ts'

let app: TestApp
beforeAll(async () => {
  app = await startTestApp()
})
afterAll(() => app.close())

const COMP = 'comp-sorsogon-2026'
const bisRows = () =>
  app.sqlite
    .prepare('SELECT ev.number AS event, r.place_from AS place, c.back_number AS back FROM results r JOIN events ev ON ev.id = r.event_id JOIN competitors c ON c.id = r.competitor_id WHERE ev.competition_id = ? AND c.back_number IS NOT NULL ORDER BY ev.number, r.place_from')
    .all(COMP) as Array<{ event: number; place: number; back: number }>

describe('comparing BIS with the paper result sheets', () => {
  it('finds no differences when the sheets agree', () => {
    const events = new Set(bisRows().map((r) => r.event))
    const rows = bisRows().filter((r) => [...events].slice(0, 3).includes(r.event))
    expect(rows.length).toBeGreaterThan(0)
    const csv = ['event,place,back_number', ...rows.map((r) => `${r.event},${r.place},${r.back}`)].join('\n')
    const result = compareResults(app.sqlite, COMP, csv)
    expect(result.differences).toEqual([])
    expect(result.matching).toBeGreaterThan(0)
  })

  it('names every difference: a different place, a dancer missing on paper, and one missing in BIS', () => {
    const [first, second] = bisRows()
    const sameEvent = bisRows().filter((r) => r.event === first!.event)
    const csv = [`${first!.event},${first!.place + 1},${first!.back}`, `${first!.event},99,77777`, ...sameEvent.slice(2).map((r) => `${r.event},${r.place},${r.back}`)].join('\n')
    const { differences } = compareResults(app.sqlite, COMP, csv)
    expect(differences).toContainEqual({ event: first!.event, backNumber: first!.back, paper: first!.place + 1, bis: first!.place })
    expect(differences).toContainEqual({ event: first!.event, backNumber: 77777, paper: 99, bis: null })
    if (sameEvent.length > 1 && second!.event === first!.event) {
      expect(differences).toContainEqual({ event: first!.event, backNumber: second!.back, paper: null, bis: second!.place })
    }
  })

  it('reports lines it cannot read instead of ignoring them', () => {
    expect(compareResults(app.sqlite, COMP, 'event,place,back_number\n1,first,12\n').unreadable).toEqual(['1,first,12'])
  })

  it('only compares the events the paper covers', () => {
    const [row] = bisRows()
    const result = compareResults(app.sqlite, COMP, `${row!.event},${row!.place},${row!.back}`)
    expect(result.events).toBe(1)
    expect(result.differences.every((d) => d.event === row!.event)).toBe(true)
  })
})
