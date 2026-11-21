import { describe, expect, it } from 'vitest'
import { mergeHeats, moveHeat, swapCouples } from './heatEdits.ts'

const map = () => new Map([['a', 1], ['b', 1], ['c', 2], ['d', 3]])

describe('heat edits', () => {
  it('merges one heat into another', () => {
    expect([...mergeHeats(map(), 3, 1)]).toEqual([['a', 1], ['b', 1], ['c', 2], ['d', 1]])
  })

  it('swaps two couples', () => {
    expect(swapCouples(map(), 'a', 'd').get('a')).toBe(3)
    expect(swapCouples(map(), 'a', 'd').get('d')).toBe(1)
  })

  it('does not swap two couples in the same heat', () => {
    expect(swapCouples(map(), 'a', 'b')).toEqual(map())
  })

  it('moves a heat to a new position and shifts the others', () => {
    expect([...moveHeat(map(), 3, 1)]).toEqual([['a', 2], ['b', 2], ['c', 3], ['d', 1]])
    expect([...moveHeat(map(), 1, 3)]).toEqual([['a', 3], ['b', 3], ['c', 1], ['d', 2]])
  })
})
