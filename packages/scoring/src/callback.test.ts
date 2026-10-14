import { describe, expect, it } from 'vitest'
import { Dance } from '@bis/shared'
import { recalledIds, ScoringError, tallyCallback, validateCallback, type CallbackInput } from './index.ts'

const JUDGES = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

// couple -> adjudicators who gave it an X, in one dance
function build(table: Record<string, string>, recallNumber: number): CallbackInput {
  const marks = Object.entries(table).flatMap(([competitorId, judges]) =>
    [...judges].map((adjudicatorId) => ({ adjudicatorId, competitorId, dance: Dance.Waltz })),
  )
  return { competitorIds: Object.keys(table), adjudicatorIds: JUDGES, dances: [Dance.Waltz], recallNumber, marks }
}

// Skating System guide, Rule 1: semi-final of 10 couples, 6 requested (totals 7, 6, 6, 6, 4, 4, 4, 3, 2, 0)
const rule1 = {
  '18': 'ABCDEFG',
  '11': 'ABCDEF',
  '15': 'ABCDEG',
  '17': 'ABCDFG',
  '10': 'ABEF',
  '12': 'CDEG',
  '14': 'ABFG',
  '13': 'CDE',
  '19': 'FG',
  '16': '',
}

describe('callback counting (Rule 1)', () => {
  it('flags the tie when the cutoff falls inside three equal totals', () => {
    const result = tallyCallback(build(rule1, 6))
    expect(result.tie).toMatchObject({ xCount: 4, fewerCount: 4, moreCount: 7 })
    expect(result.tie?.competitorIds.sort()).toEqual(['10', '12', '14'])
    expect(result.rows.filter((r) => r.outcome === 'tied')).toHaveLength(3)
  })

  it('recalls the chairperson\'s choice of fewer or more', () => {
    const result = tallyCallback(build(rule1, 6))
    expect(recalledIds(result, 'fewer').sort()).toEqual(['11', '15', '17', '18'])
    expect(recalledIds(result, 'more')).toHaveLength(7)
  })

  it('refuses to recall before the tie is decided', () => {
    expect(() => recalledIds(tallyCallback(build(rule1, 6)))).toThrow(ScoringError)
  })

  it('has no tie when the cutoff falls between totals', () => {
    // Each adjudicator marks 2: a gets all seven, b and c split the rest
    const result = tallyCallback(build({ a: 'ABCDEFG', b: 'ABCD', c: 'EFG' }, 2))
    expect(result.tie).toBeNull()
    expect(recalledIds(result)).toEqual(['a', 'b'])
  })

  it('refuses to recall nobody when the tie starts at the top', () => {
    const result = tallyCallback(build({ a: 'ABC', b: 'DEF', c: 'G' }, 1))
    expect(result.tie).toMatchObject({ fewerCount: 0, moreCount: 2 })
    expect(() => recalledIds(result, 'fewer')).toThrow(ScoringError)
    expect(recalledIds(result, 'more')).toHaveLength(2)
  })

  it('ranks equal totals together', () => {
    const rows = tallyCallback(build(rule1, 6)).rows
    expect(rows.find((r) => r.competitorId === '18')?.rank).toBe(1)
    expect(rows.find((r) => r.competitorId === '11')?.rank).toBe(2)
    expect(rows.find((r) => r.competitorId === '10')?.rank).toBe(5)
  })

  it('sums X marks across the dances of the round', () => {
    const marks = (['a', 'b'] as const).flatMap((competitorId) =>
      [Dance.Waltz, Dance.Tango].map((dance) => ({ adjudicatorId: 'A', competitorId, dance })),
    )
    const result = tallyCallback({
      competitorIds: ['a', 'b', 'c'],
      adjudicatorIds: ['A'],
      dances: [Dance.Waltz, Dance.Tango],
      recallNumber: 2,
      marks,
    })
    expect(result.rows.find((r) => r.competitorId === 'a')?.xCount).toBe(2)
  })
})

describe('callback validation', () => {
  it('reports an adjudicator who marked the wrong number', () => {
    const input = build(rule1, 6)
    input.marks = input.marks.filter((m) => !(m.adjudicatorId === 'A' && m.competitorId === '18'))
    expect(validateCallback(input)).toEqual(['Adjudicator A marked 5 in waltz, not 6.'])
    expect(() => tallyCallback(input)).toThrow(ScoringError)
  })

  it('reports an adjudicator who has not submitted', () => {
    const input = build(rule1, 6)
    input.marks = input.marks.filter((m) => m.adjudicatorId !== 'G')
    expect(validateCallback(input)).toContain('Adjudicator G marked 0 in waltz, not 6.')
  })

  it('reports duplicate marks and unknown back numbers', () => {
    const input = build(rule1, 6)
    input.marks.push({ adjudicatorId: 'A', competitorId: '18', dance: Dance.Waltz })
    input.marks.push({ adjudicatorId: 'A', competitorId: '99', dance: Dance.Waltz })
    const issues = validateCallback(input)
    expect(issues).toContain('Adjudicator A marked 18 twice in waltz.')
    expect(issues).toContain('Unknown competitor 99.')
  })

  it('rejects a recall number larger than the field', () => {
    expect(validateCallback(build({ a: 'A' }, 3))[0]).toMatch(/Recall number 3/)
  })
})
