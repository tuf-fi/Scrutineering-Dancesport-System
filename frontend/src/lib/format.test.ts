import { DISCIPLINE_DANCES } from '@bis/shared'
import { describe, expect, it } from 'vitest'
import { eventDances, placeRange } from './format.ts'

describe('placeRange', () => {
  it('writes a tie in a final as a range', () => {
    expect(placeRange({ placeFrom: 3, placeTo: 4 })).toBe('3rd–4th')
    expect(placeRange({ placeFrom: 1, placeTo: 2 })).toBe('1st–2nd')
  })

  it('is null for an unshared place or nothing stored', () => {
    expect(placeRange({ placeFrom: 3, placeTo: 3 })).toBeNull()
    expect(placeRange({ placeFrom: 7, placeTo: 8 })).toBe('7th–8th')
    expect(placeRange({ placeFrom: 13, placeTo: 18 })).toBe('13th–18th')
    expect(placeRange({})).toBeNull()
  })
})

describe('eventDances', () => {
  it('names a single dance in full', () => {
    expect(eventDances({ dances: ['cha_cha_cha'] })).toBe('Cha Cha Cha')
  })

  it('shows two or more dances as the discipline and their letters', () => {
    expect(eventDances({ dances: DISCIPLINE_DANCES.latin })).toBe('Latin - S C R P J')
    expect(eventDances({ dances: DISCIPLINE_DANCES.standard })).toBe('Standard - W T V F Q')
    expect(eventDances({ dances: ['cha_cha_cha', 'jive'] })).toBe('Latin - C J')
  })
})
