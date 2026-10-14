import { describe, expect, it } from 'vitest'
import { placeDance, ScoringError, validateDance, type DanceInput } from './index.ts'

// couple -> placings from adjudicators A, B, C... in order
function build(table: Record<string, number[]>): DanceInput {
  const adjudicatorIds = 'ABCDEFG'.slice(0, Object.values(table)[0]!.length).split('')
  const marks = Object.entries(table).flatMap(([competitorId, placings]) =>
    placings.map((placing, i) => ({ adjudicatorId: adjudicatorIds[i]!, competitorId, placing })),
  )
  return { competitorIds: Object.keys(table), adjudicatorIds, marks }
}

const placesOf = (table: Record<string, number[]>) =>
  Object.fromEntries(placeDance(build(table)).places.map((p) => [p.competitorId, p.place]))

// Examples below are the worked tables in the Skating System guide (Rules 5-8)
describe('single dance final', () => {
  it('Rule 5: a majority of 1st places wins, then 2nd and higher, and so on', () => {
    expect(
      placesOf({
        '51': [1, 1, 1, 2, 1],
        '52': [4, 2, 2, 1, 2],
        '53': [3, 3, 3, 5, 4],
        '54': [2, 4, 5, 4, 3],
        '55': [5, 6, 4, 3, 5],
        '56': [6, 5, 6, 6, 6],
      }),
    ).toEqual({ '51': 1, '52': 2, '53': 3, '54': 4, '55': 5, '56': 6 })
  })

  it('Rule 6: the greater majority wins, and one column can place several couples', () => {
    expect(
      placesOf({
        '61': [1, 1, 2, 1, 4, 2, 1],
        '62': [6, 2, 1, 5, 2, 1, 2],
        '63': [2, 4, 3, 3, 6, 3, 3],
        '64': [3, 3, 5, 2, 1, 5, 4],
        '65': [4, 5, 6, 4, 3, 6, 5],
        '66': [5, 6, 4, 6, 5, 4, 6],
      }),
    ).toEqual({ '61': 1, '62': 2, '63': 3, '64': 4, '65': 5, '66': 6 })
  })

  it('Rule 7: equal majority goes to the lower sum, then to the next column', () => {
    const result = placeDance(
      build({
        '71': [3, 1, 6, 1, 1, 2, 1],
        '72': [2, 2, 1, 5, 3, 1, 3],
        '73': [1, 5, 4, 2, 2, 6, 2],
        '74': [5, 4, 2, 4, 6, 5, 4],
        '75': [4, 6, 3, 3, 5, 4, 6],
        '76': [6, 3, 5, 6, 4, 3, 5],
      }),
    )
    expect(Object.fromEntries(result.places.map((p) => [p.competitorId, p.place]))).toEqual({
      '71': 1, '72': 2, '73': 3, '74': 4, '75': 5, '76': 6,
    })
    // 72 beats 73 on sum (6 against 7) in the "2nd and higher" column
    expect(result.columns['72']![1]).toEqual({ count: 4, sum: 6 })
    expect(result.columns['73']![1]).toEqual({ count: 4, sum: 7 })
    // 74 and 75 tie on count and sum at "4th and higher" (4 marks, 14), so 5th and higher decides
    expect(result.columns['74']![3]).toEqual({ count: 4, sum: 14 })
    expect(result.columns['75']![3]).toEqual({ count: 4, sum: 14 })
  })

  it('Rule 7: couples equal in every column share the average place', () => {
    const result = placeDance(build({ a: [1, 2], b: [2, 1], c: [3, 3] }))
    const a = result.places.find((p) => p.competitorId === 'a')!
    const b = result.places.find((p) => p.competitorId === 'b')!
    expect(a).toMatchObject({ place: 1.5, announcedPlace: 1, shared: true })
    expect(b).toMatchObject({ place: 1.5, announcedPlace: 1, shared: true })
    expect(result.places.find((p) => p.competitorId === 'c')).toMatchObject({ place: 3, shared: false })
  })

  it('Rule 8: with no majority, move on to the next column', () => {
    expect(
      placesOf({
        '81': [3, 3, 3, 2, 5, 2, 3],
        '82': [4, 4, 4, 3, 2, 3, 2],
        '83': [2, 2, 6, 6, 4, 1, 4],
        '84': [1, 6, 1, 5, 1, 4, 6],
        '85': [5, 5, 5, 1, 3, 6, 1],
        '86': [6, 1, 2, 4, 6, 5, 5],
      }),
    ).toEqual({ '81': 1, '82': 2, '83': 3, '84': 4, '85': 5, '86': 6 })
  })

  it('places a solo final of one competitor', () => {
    expect(placesOf({ a: [1, 1, 1] })).toEqual({ a: 1 })
  })

  it('gives every competitor exactly one place for any valid marks', () => {
    for (let seed = 1; seed <= 200; seed++) {
      let s = seed
      const rand = () => (s = (s * 48271) % 2147483647) / 2147483647
      const n = 2 + (seed % 6)
      const judges = seed % 2 ? 5 : 7
      const ids = Array.from({ length: n }, (_, i) => `c${i}`)
      const table: Record<string, number[]> = Object.fromEntries(ids.map((id) => [id, []]))
      for (let j = 0; j < judges; j++) {
        const order = [...ids].sort(() => rand() - 0.5)
        order.forEach((id, i) => table[id]!.push(i + 1))
      }
      const places = placeDance(build(table)).places
      expect(places).toHaveLength(n)
      expect(new Set(places.map((p) => p.competitorId)).size).toBe(n)
      // Shared averages still add up to 1 + 2 + ... + n
      expect(places.reduce((total, p) => total + p.place, 0)).toBeCloseTo((n * (n + 1)) / 2)
    }
  })
})

describe('final validation', () => {
  it('rejects an adjudicator who used a place twice', () => {
    const input = build({ a: [1, 1, 1], b: [1, 2, 2], c: [3, 3, 3] })
    expect(validateDance(input)).toEqual(['Adjudicator A used a place more than once.'])
    expect(() => placeDance(input)).toThrow(ScoringError)
  })

  it('rejects an adjudicator who left a competitor unplaced', () => {
    const input = build({ a: [1, 1, 1], b: [2, 2, 2], c: [3, 3, 3] })
    input.marks = input.marks.filter((m) => !(m.adjudicatorId === 'C' && m.competitorId === 'c'))
    expect(validateDance(input)).toEqual(['Adjudicator C must place all 3 competitors once.'])
  })

  it('rejects a placing outside 1 to the number of finalists', () => {
    const input = build({ a: [1, 1, 1], b: [2, 2, 2] })
    input.marks[0]!.placing = 5
    expect(validateDance(input)[0]).toMatch(/invalid placing 5/)
  })
})

describe('single dance edge cases', () => {
  it('splits a three-way tie by sum, then shares what cannot be split', () => {
    // 6 adjudicators: a, b and c are identical in every column, d is clearly last
    const result = placeDance(
      build({ a: [1, 2, 3, 1, 2, 3], b: [2, 3, 1, 2, 3, 1], c: [3, 1, 2, 3, 1, 2], d: [4, 4, 4, 4, 4, 4] }),
    )
    const by = Object.fromEntries(result.places.map((p) => [p.competitorId, p]))
    expect(by.a).toMatchObject({ place: 2, announcedPlace: 1, shared: true })
    expect(by.b).toMatchObject({ place: 2, announcedPlace: 1, shared: true })
    expect(by.c).toMatchObject({ place: 2, announcedPlace: 1, shared: true })
    expect(by.d).toMatchObject({ place: 4, shared: false })
  })

  it('places a seven-competitor final', () => {
    const table: Record<string, number[]> = {}
    for (let c = 0; c < 7; c++) table[`c${c + 1}`] = Array.from({ length: 5 }, () => c + 1)
    const places = placeDance(build(table)).places
    expect(places.map((p) => [p.competitorId, p.place])).toEqual([1, 2, 3, 4, 5, 6, 7].map((n) => [`c${n}`, n]))
  })

  it('places an even panel using more than half as the majority', () => {
    const result = placeDance(build({ a: [1, 1, 2, 2], b: [2, 2, 1, 1] }))
    // 2 of 4 is not a majority; both have 4 marks of 2nd or higher and sum 6, so they share
    expect(result.majority).toBe(3)
    expect(result.places.every((p) => p.shared && p.place === 1.5)).toBe(true)
  })

  it('reports the working for each competitor', () => {
    const result = placeDance(build({ a: [1, 1, 1], b: [2, 2, 2] }))
    expect(result.columns.a).toEqual([
      { count: 3, sum: 3 },
      { count: 3, sum: 3 },
    ])
    expect(result.columns.b).toEqual([
      { count: 0, sum: 0 },
      { count: 3, sum: 6 },
    ])
  })
})
