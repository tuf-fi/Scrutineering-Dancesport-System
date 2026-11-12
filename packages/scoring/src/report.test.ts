import { describe, expect, it } from 'vitest'
import { Dance, RoundType } from '@bis/shared'
import { buildEventReport, type ReportMark } from './index.ts'

const adjudicators = ['A', 'B', 'C'].map((letter) => ({ id: letter, letter }))
const people = new Map(['1', '2', '3', '4'].map((id) => [id, { competitorId: id, backNumber: Number(id), names: [`Dancer ${id}`], team: 'Team' }]))

const xs = (table: Record<string, string>): ReportMark[] =>
  Object.entries(table).flatMap(([competitorId, who]) => [...who].map((adjudicatorId) => ({ adjudicatorId, competitorId, dance: Dance.Waltz, placing: null, kind: 'x' as const })))
const placings = (table: Record<string, number[]>): ReportMark[] =>
  Object.entries(table).flatMap(([competitorId, list]) => list.map((placing, i) => ({ adjudicatorId: 'ABC'[i]!, competitorId, dance: Dance.Waltz, placing, kind: 'placing' as const })))

describe('the public event report', () => {
  const report = buildEventReport({
    rounds: [
      { type: RoundType.SemiFinal, isFinal: false, adjudicators, field: ['1', '2', '3', '4'], marks: xs({ '1': 'ABC', '2': 'ABC', '3': 'AB', '4': 'C' }) },
      { type: RoundType.Final, isFinal: true, adjudicators, field: ['1', '2', '3'], marks: placings({ '1': [1, 2, 1], '2': [2, 1, 2], '3': [3, 3, 3] }) },
    ],
    people,
    results: [
      { competitorId: '1', place: 1, placeFrom: 1, placeTo: 1 },
      { competitorId: '2', place: 2, placeFrom: 2, placeTo: 2 },
      { competitorId: '3', place: 3, placeFrom: 3, placeTo: 3 },
      { competitorId: '4', place: 4, placeFrom: 4, placeTo: 4 },
    ],
  })

  it('lists the final, then those cut in each earlier round', () => {
    expect(report.listing.map((l) => [l.roundType, l.rows.map((r) => r.competitorId)])).toEqual([
      ['final', ['1', '2', '3']],
      ['semi_final', ['4']],
    ])
  })

  it('reports the final with each adjudicator\'s placing, the dance place and the total', () => {
    const final = report.rounds[0]!
    expect(final.isFinal).toBe(true)
    expect(final.letters).toEqual(['A', 'B', 'C'])
    expect(final.rows.map((r) => [r.competitorId, r.perDance[0]!.marks, r.place, r.total])).toEqual([
      ['1', [1, 2, 1], 1, 1],
      ['2', [2, 1, 2], 2, 2],
      ['3', [3, 3, 3], 3, 3],
    ])
  })

  it('reports an earlier round with the X marks, the total and who went through', () => {
    const semi = report.rounds[1]!
    expect(semi.rows.map((r) => [r.competitorId, r.perDance[0]!.marks, r.total, r.recalled])).toEqual([
      ['1', [1, 1, 1], 3, true],
      ['2', [1, 1, 1], 3, true],
      ['3', [1, 1, null], 2, true],
      ['4', [null, null, 1], 1, false],
    ])
  })

  it('ranks every competitor with what they got in each round, final first', () => {
    expect(report.ranking.map((r) => [r.competitorId, r.rounds.map((x) => x.value)])).toEqual([
      ['1', [1, 3]],
      ['2', [2, 3]],
      ['3', [3, 2]],
      ['4', [1]],
    ])
  })
})
