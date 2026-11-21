import { describe, expect, it } from 'vitest'
import { adjudicatorSets } from './format.ts'

describe('adjudicatorSets', () => {
  it('names each different group of adjudicators Set A, Set B... in order of appearance', () => {
    const rows = [{ adjudicators: ['A', 'B', 'C', 'D', 'E'] }, { adjudicators: ['B', 'C', 'D', 'E', 'F'] }, { adjudicators: ['E', 'D', 'C', 'B', 'A'] }, { adjudicators: [] }]
    const name = adjudicatorSets(rows)
    expect(name(rows[0]!.adjudicators)).toBe('Set A')
    expect(name(rows[1]!.adjudicators)).toBe('Set B')
    expect(name(rows[2]!.adjudicators)).toBe('Set A')
    expect(name([])).toBe('')
  })
})
