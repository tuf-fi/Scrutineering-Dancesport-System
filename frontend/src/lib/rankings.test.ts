import { AgeGroup, Class, Discipline, type RankingPoint } from '@bis/shared'
import { describe, expect, it } from 'vitest'
import { availableClasses, categoriesOf, rankCategory } from './rankings.ts'

const J1_E1_LATIN = { ageGroup: AgeGroup.Junior1, class: Class.E1, discipline: Discipline.Latin }

let n = 0
const point = (
  competitorId: string,
  points: number,
  over: Partial<RankingPoint> = {},
): RankingPoint => ({
  id: `rp-${n++}`,
  competitorId,
  competitionId: 'comp-1',
  points,
  ...J1_E1_LATIN,
  ...over,
})

describe('rankCategory', () => {
  it('adds up points across events and competitions, highest first', () => {
    const rows = rankCategory(
      [
        point('a', 5),
        point('a', 8, { competitionId: 'comp-2' }),
        point('b', 10),
        point('c', 3),
      ],
      J1_E1_LATIN,
    )
    expect(rows.map((r) => [r.competitorId, r.points, r.rank])).toEqual([
      ['a', 13, 1],
      ['b', 10, 2],
      ['c', 3, 3],
    ])
  })

  it('counts each competition once, however many events it had', () => {
    const [row] = rankCategory(
      [point('a', 4), point('a', 3), point('a', 2, { competitionId: 'comp-2' })],
      J1_E1_LATIN,
    )
    expect(row.competitions).toBe(2)
  })

  it('gives equal points the same rank and skips the next one', () => {
    const rows = rankCategory(
      [point('a', 10), point('b', 8), point('c', 8), point('d', 5)],
      J1_E1_LATIN,
    )
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 2, 4])
  })

  it('breaks the listing order of a tie by more competitions, then id, without changing the rank', () => {
    const rows = rankCategory(
      [point('b', 8), point('a', 4), point('a', 4, { competitionId: 'comp-2' })],
      J1_E1_LATIN,
    )
    expect(rows.map((r) => r.competitorId)).toEqual(['a', 'b'])
    expect(rows.map((r) => r.rank)).toEqual([1, 1])
  })

  it('keeps categories apart', () => {
    const rows = rankCategory(
      [
        point('a', 10),
        point('a', 7, { discipline: Discipline.Standard }),
        point('b', 6, { ageGroup: AgeGroup.Youth }),
        point('c', 4, { class: Class.D }),
      ],
      J1_E1_LATIN,
    )
    expect(rows.map((r) => r.competitorId)).toEqual(['a'])
    expect(rows[0].points).toBe(10)
  })

  it('returns nothing for a category with no points', () => {
    expect(rankCategory([point('a', 5)], { ...J1_E1_LATIN, ageGroup: AgeGroup.Senior })).toEqual([])
  })
})

describe('availableClasses', () => {
  it('lists classes that have data in the usual order', () => {
    const classes = availableClasses([point('a', 1, { class: Class.C }), point('b', 1), point('c', 1, { class: Class.D })])
    expect(classes).toEqual([Class.E1, Class.D, Class.C])
  })
})

describe('categoriesOf', () => {
  it('lists each category a competitor has points in once', () => {
    const cats = categoriesOf(
      [point('a', 1), point('a', 2), point('a', 3, { discipline: Discipline.Standard }), point('b', 9)],
      'a',
    )
    expect(cats).toHaveLength(2)
  })
})
