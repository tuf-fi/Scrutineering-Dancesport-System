import { describe, expect, it } from 'vitest'
import { Dance } from '@bis/shared'
import { placeDance, placeFinal, validateCallback } from './index.ts'
import finalSheet from '../fixtures/bicol-single-dance-final.json'
import selectionSheet from '../fixtures/bicol-selection-12-to-6.json'
import berlin from '../fixtures/wdsf-berlin-2014-junior2-standard.json'
import yerevan from '../fixtures/wdsf-yerevan-2021-youth-latin.json'
import burgas from '../fixtures/wdsf-burgas-2025-junior2-ten-dance.json'

interface WdsfSheet {
  adjudicators: string[]
  dances: Array<{ dance: string; marks: Record<string, number[]> }>
  expectedDancePlaces: Record<string, number[]>
  expectedPlaces: Record<string, number>
  decidedBy: Record<string, string>
}

// Published WDSF final reports: each adjudicator's placing per dance, and the places the report gives
const WDSF: Array<[string, WdsfSheet]> = [
  ['Berlin 2014 Junior II Standard, Rule 10 splits a tie on 13', berlin],
  ['Yerevan 2021 Youth Latin, Rule 11 splits a tie on 17.5', yerevan],
  ['Burgas 2025 Junior II Ten Dance, Rule 10 splits a tie on 52', burgas],
]

describe('WDSF final reports', () => {
  it.each(WDSF)('places %s as published', (_name, sheet) => {
    const competitorIds = Object.keys(sheet.dances[0]!.marks)
    const result = placeFinal({
      competitorIds,
      adjudicatorIds: sheet.adjudicators,
      dances: sheet.dances.map((d) => ({
        dance: d.dance as Dance,
        marks: Object.entries(d.marks).flatMap(([competitorId, placings]) =>
          placings.map((placing, i) => ({ adjudicatorId: sheet.adjudicators[i]!, competitorId, placing })),
        ),
      })),
    })
    const byId = new Map(result.rows.map((r) => [r.competitorId, r]))
    for (const id of competitorIds) {
      const row = byId.get(id)!
      expect(row.place, `place of ${id}`).toBe(sheet.expectedPlaces[id])
      expect(sheet.dances.map((d) => row.dancePlaces[d.dance as Dance]), `dance places of ${id}`).toEqual(sheet.expectedDancePlaces[id])
    }
    for (const [id, rule] of Object.entries(sheet.decidedBy)) expect(byId.get(id)!.decidedBy, `rule for ${id}`).toBe(rule)
  })
})

describe('real result sheets', () => {
  it('places a single-dance final as the organizer\'s sheet does', () => {
    const sheet = finalSheet
    const { adjudicators, expectedPlaces } = sheet
    const marks = Object.entries(sheet.dances[0]!.marks).flatMap(([competitorId, placings]) =>
      placings.map((placing, i) => ({ adjudicatorId: adjudicators[i]!, competitorId, placing })),
    )
    const result = placeDance({ competitorIds: Object.keys(sheet.dances[0]!.marks), adjudicatorIds: adjudicators, marks })
    expect(Object.fromEntries(result.places.map((p) => [p.competitorId, p.place]))).toEqual(expectedPlaces)
  })

  it('adds up the X marks of the 12 to 6 selection sheet, which has more than 6 X for some adjudicators', () => {
    const sheet = selectionSheet
    const marks = Object.entries(sheet.xMarks).flatMap(([competitorId, who]) =>
      [...who].map((adjudicatorId) => ({ adjudicatorId, competitorId, dance: Dance.Waltz })),
    )
    const totals = Object.fromEntries(Object.keys(sheet.xMarks).map((id) => [id, marks.filter((m) => m.competitorId === id).length]))
    expect(totals).toEqual(sheet.expectedTotals)

    const top = Object.keys(totals)
      .sort((a, b) => totals[b]! - totals[a]!)
      .slice(0, sheet.recallNumber)
      .sort((a, b) => Number(a) - Number(b))
    expect(top).toEqual(sheet.expectedRecalled)

    // BIS holds every adjudicator to exactly the recall number, so this sheet could not be entered as it stands
    const issues = validateCallback({
      competitorIds: Object.keys(sheet.xMarks),
      adjudicatorIds: sheet.adjudicators,
      dances: [Dance.Waltz],
      recallNumber: sheet.recallNumber,
      marks,
    })
    expect(issues.length).toBeGreaterThan(0)
  })
})
