import { describe, expect, it } from 'vitest'
import { Dance } from '@bis/shared'
import { combineDances, placeFinal, ScoringError, type PlacingMark } from './index.ts'

// couple -> one dance's place per dance, as in the guide's Final Summary tables
function summary(table: Record<string, number[]>) {
  const ids = Object.keys(table)
  const dances = table[ids[0]!]!.map((_, d) => Object.fromEntries(ids.map((id) => [id, table[id]![d]!])))
  return Object.fromEntries([...combineDances(ids, dances)].map(([id, p]) => [id, p.place]))
}

describe('final summary (Rules 9 and 10)', () => {
  it('Rule 9: lowest total wins', () => {
    expect(
      summary({
        '91': [1, 1, 1, 1, 1],
        '92': [4, 2, 2, 2, 2],
        '93': [2, 3, 3, 3, 3],
        '94': [5, 5, 6, 4, 5],
        '95': [3, 4, 5, 7, 7],
        '96': [6, 7, 4, 5, 6],
        '97': [7, 6, 7, 6, 4],
        '98': [8, 8, 8, 8, 8],
      }),
    ).toEqual({ '91': 1, '92': 2, '93': 3, '94': 4, '95': 5, '96': 6, '97': 7, '98': 8 })
  })

  it('Rule 10: equal totals go to the most 1st places, then the lower sum of 3rd and higher', () => {
    expect(
      summary({
        '101': [1, 1, 3],
        '102': [2, 2, 1],
        '103': [6, 4, 2],
        '104': [5, 3, 4],
        '105': [4, 5, 5],
        '106': [3, 6, 6],
      }),
    ).toEqual({ '101': 1, '102': 2, '103': 3, '104': 4, '105': 5, '106': 6 })
  })

  it('Rule 10: four couples on one total are placed one at a time', () => {
    expect(
      summary({
        '101': [1, 6, 4, 1],
        '102': [6, 2, 2, 2],
        '103': [2, 1, 6, 3],
        '104': [3, 4, 1, 4],
        '105': [5, 3, 5, 5],
        '106': [4, 5, 3, 6],
      }),
    ).toEqual({ '101': 1, '102': 2, '103': 3, '104': 4, '105': 5, '106': 6 })
  })

  it('leaves a Rule 11 tie shared when there are no marks to break it', () => {
    expect(summary({ a: [1, 2], b: [2, 1], c: [3, 3] })).toEqual({ a: 1.5, b: 1.5, c: 3 })
  })
})

// competitor -> one adjudicator's placing each (A, B, C...)
const dance = (dance: Dance, table: Record<string, number[]>) => ({
  dance,
  marks: Object.entries(table).flatMap(([competitorId, placings]) =>
    placings.map<PlacingMark>((placing, i) => ({ adjudicatorId: 'ABCDEFG'[i]!, competitorId, placing })),
  ),
})

describe('multi-dance final', () => {
  it('Rule 11: all marks count as one dance when Rule 10 cannot split the tie', () => {
    const result = placeFinal({
      competitorIds: ['A', 'B', 'C'],
      adjudicatorIds: ['A', 'B', 'C'],
      dances: [
        dance(Dance.Waltz, { A: [1, 1, 2], B: [2, 2, 1], C: [3, 3, 3] }),
        dance(Dance.Tango, { A: [2, 2, 1], B: [1, 1, 3], C: [3, 3, 2] }),
      ],
    })
    // A and B each win a dance and total 3. Over all six marks A has 6 in "2nd and higher", B 5
    expect(result.rows.map((r) => [r.competitorId, r.place, r.decidedBy])).toEqual([
      ['A', 1, 'rule11'],
      ['B', 2, 'rule10'],
      ['C', 3, 'total'],
    ])
    expect(result.rows[0]!.dancePlaces).toEqual({ waltz: 1, tango: 2 })
  })

  it('shares the place when Rule 11 cannot split the tie either', () => {
    const result = placeFinal({
      competitorIds: ['A', 'B'],
      adjudicatorIds: ['A', 'B', 'C'],
      dances: [
        dance(Dance.Waltz, { A: [1, 1, 2], B: [2, 2, 1] }),
        dance(Dance.Tango, { A: [2, 2, 1], B: [1, 1, 2] }),
      ],
    })
    expect(result.rows.map((r) => [r.place, r.announcedPlace, r.shared, r.decidedBy])).toEqual([
      [1.5, 1, true, 'shared'],
      [1.5, 1, true, 'shared'],
    ])
  })

  it('reduces to the single-dance rules for a one-dance final', () => {
    const result = placeFinal({
      competitorIds: ['a', 'b', 'c'],
      adjudicatorIds: ['A', 'B', 'C'],
      dances: [dance(Dance.Waltz, { a: [2, 2, 1], b: [1, 1, 2], c: [3, 3, 3] })],
    })
    expect(result.rows.map((r) => r.competitorId)).toEqual(['b', 'a', 'c'])
  })

  it('places 2- to 5-dance finals with every competitor placed exactly once', () => {
    const dances = [Dance.Samba, Dance.ChaChaCha, Dance.Rumba, Dance.PasoDoble, Dance.Jive]
    for (let seed = 1; seed <= 200; seed++) {
      let s = seed
      const rand = () => (s = (s * 48271) % 2147483647) / 2147483647
      const n = 2 + (seed % 6)
      const judges = seed % 2 ? 5 : 7
      const ids = Array.from({ length: n }, (_, i) => `c${i}`)
      const danceCount = 2 + (seed % 4)
      const input = {
        competitorIds: ids,
        adjudicatorIds: 'ABCDEFG'.slice(0, judges).split(''),
        dances: dances.slice(0, danceCount).map((d) => {
          const table: Record<string, number[]> = Object.fromEntries(ids.map((id) => [id, []]))
          for (let j = 0; j < judges; j++) {
            ;[...ids].sort(() => rand() - 0.5).forEach((id, i) => table[id]!.push(i + 1))
          }
          return dance(d, table)
        }),
      }
      const { rows } = placeFinal(input)
      expect(rows).toHaveLength(n)
      expect(new Set(rows.map((r) => r.competitorId)).size).toBe(n)
      expect(rows.reduce((total, r) => total + r.place, 0)).toBeCloseTo((n * (n + 1)) / 2)
    }
  })

  it('reports problems per dance', () => {
    expect(() =>
      placeFinal({
        competitorIds: ['a', 'b'],
        adjudicatorIds: ['A'],
        dances: [dance(Dance.Waltz, { a: [1], b: [1] })],
      }),
    ).toThrow(ScoringError)
    expect(() => placeFinal({ competitorIds: ['a'], adjudicatorIds: ['A'], dances: [] })).toThrow(/at least one dance/)
  })
})

describe('multi-dance edge cases', () => {
  const D = [Dance.Waltz, Dance.Tango, Dance.VienneseWaltz]
  const unanimous = (order: string[]) =>
    Object.fromEntries(order.map((id, i) => [id, [i + 1, i + 1, i + 1]]))

  it('places a three-dance final won by the same couple in every dance', () => {
    const result = placeFinal({
      competitorIds: ['a', 'b', 'c'],
      adjudicatorIds: ['A', 'B', 'C'],
      dances: D.map((d) => dance(d, unanimous(['a', 'b', 'c']))),
    })
    expect(result.rows.map((r) => [r.competitorId, r.place, r.total])).toEqual([['a', 1, 3], ['b', 2, 6], ['c', 3, 9]])
  })

  it('lets a couple win the section without winning a dance (Rule 9 rewards overall performance)', () => {
    const result = placeFinal({
      competitorIds: ['a', 'b', 'c'],
      adjudicatorIds: ['A', 'B', 'C'],
      dances: [
        dance(Dance.Waltz, unanimous(['a', 'b', 'c'])),
        dance(Dance.Tango, unanimous(['c', 'b', 'a'])),
        dance(Dance.VienneseWaltz, { a: [3, 3, 3], b: [1, 1, 1], c: [2, 2, 2] }),
      ],
    })
    // totals: a 1+3+3 = 7, b 2+2+1 = 5, c 3+1+2 = 6
    expect(result.rows.map((r) => r.competitorId)).toEqual(['b', 'c', 'a'])
  })

  it('places a solo final', () => {
    const result = placeFinal({
      competitorIds: ['s'],
      adjudicatorIds: ['A', 'B', 'C'],
      dances: [dance(Dance.Samba, { s: [1, 1, 1] }), dance(Dance.Rumba, { s: [1, 1, 1] })],
    })
    expect(result.rows[0]).toMatchObject({ place: 1, total: 2 })
  })

  it('rejects a repeated dance', () => {
    const d = dance(Dance.Waltz, { a: [1, 1, 1] })
    expect(() => placeFinal({ competitorIds: ['a'], adjudicatorIds: ['A', 'B', 'C'], dances: [d, d] })).toThrow(/more than once/)
  })
})
