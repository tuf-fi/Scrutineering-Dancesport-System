import { describe, expect, it } from 'vitest'
import { placeRange } from './format.ts'

describe('placeRange', () => {
  it('writes a tie in a final as a range', () => {
    expect(placeRange({ placeFrom: 3, placeTo: 4 })).toBe('3rd–4th')
    expect(placeRange({ placeFrom: 1, placeTo: 2 })).toBe('1st–2nd')
  })

  it('is null for an unshared place, an earlier round, or nothing stored', () => {
    expect(placeRange({ placeFrom: 3, placeTo: 3 })).toBeNull()
    expect(placeRange({ placeFrom: 13, placeTo: 18 })).toBeNull()
    expect(placeRange({})).toBeNull()
  })
})
