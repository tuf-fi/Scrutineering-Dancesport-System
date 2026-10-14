import { describe, expect, it } from 'vitest'
import { placeEliminated, ScoringError, type RoundOutcome } from './index.ts'

const ids = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `c${from + i}`)

// 30 start, then 24, 18, 12 and 6 recalled
const rounds: RoundOutcome[] = [
  { roundType: 'round_1', competitorIds: ids(1, 30), recalledIds: ids(1, 24) },
  { roundType: 'round_2', competitorIds: ids(1, 24), recalledIds: ids(1, 18) },
  { roundType: 'quarter_final', competitorIds: ids(1, 18), recalledIds: ids(1, 12) },
  { roundType: 'semi_final', competitorIds: ids(1, 12), recalledIds: ids(1, 6) },
]

describe('places for competitors cut before the final', () => {
  const placed = placeEliminated(rounds)
  const rangeOf = (id: string) => placed.find((p) => p.competitorId === id)!

  it('gives everyone cut in a round the same range below those who went further', () => {
    expect(rangeOf('c7')).toMatchObject({ roundType: 'semi_final', from: 7, to: 12, announcedPlace: 7, place: 9.5 })
    expect(rangeOf('c13')).toMatchObject({ roundType: 'quarter_final', from: 13, to: 18 })
    expect(rangeOf('c19')).toMatchObject({ roundType: 'round_2', from: 19, to: 24 })
    expect(rangeOf('c25')).toMatchObject({ roundType: 'round_1', from: 25, to: 30, announcedPlace: 25 })
  })

  it('places every cut competitor and leaves the finalists out', () => {
    expect(placed).toHaveLength(24)
    expect(placed.some((p) => ['c1', 'c6'].includes(p.competitorId))).toBe(false)
  })

  it('keeps X counts for the printout without letting them reorder the range', () => {
    const withCounts = placeEliminated([
      { ...rounds[3]!, xCounts: { c7: 3, c8: 5 } },
    ].map((r) => ({ ...r, competitorIds: ids(1, 12) })))
    expect(withCounts.find((p) => p.competitorId === 'c7')).toMatchObject({ xCount: 3, from: 7, to: 12 })
    expect(withCounts.find((p) => p.competitorId === 'c8')).toMatchObject({ xCount: 5, from: 7, to: 12 })
  })

  it('skips a round where nobody was cut', () => {
    const result = placeEliminated([
      { roundType: 'round_1', competitorIds: ids(1, 8), recalledIds: ids(1, 8) },
      { roundType: 'semi_final', competitorIds: ids(1, 8), recalledIds: ids(1, 6) },
    ])
    expect(result.map((p) => [p.competitorId, p.from, p.to])).toEqual([['c7', 7, 8], ['c8', 7, 8]])
  })

  it('has nobody to place in a straight final', () => {
    expect(placeEliminated([])).toEqual([])
  })

  it('rejects rounds that do not follow on from each other', () => {
    expect(() =>
      placeEliminated([
        { roundType: 'round_1', competitorIds: ids(1, 10), recalledIds: ids(1, 8) },
        { roundType: 'semi_final', competitorIds: ids(1, 7), recalledIds: ids(1, 6) },
      ]),
    ).toThrow(ScoringError)
    expect(() =>
      placeEliminated([{ roundType: 'semi_final', competitorIds: ids(1, 4), recalledIds: ['c9'] }]),
    ).toThrow(/did not dance/)
  })
})
