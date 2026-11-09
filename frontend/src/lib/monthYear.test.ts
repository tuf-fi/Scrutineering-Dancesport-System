import { parseMonthYear } from '@bis/shared'
import { describe, expect, it } from 'vitest'

describe('parseMonthYear', () => {
  it.each([
    ['January 2026', { month: 1, year: 2026 }],
    ['november 2026', { month: 11, year: 2026 }],
    ['Nov 2026', { month: 11, year: 2026 }],
    ['Sept. 2026', { month: 9, year: 2026 }],
    ['3/2026', { month: 3, year: 2026 }],
    ['2026', { month: null, year: 2026 }],
  ])('reads %s', (text, expected) => expect(parseMonthYear(text)).toEqual(expected))

  it.each(['Smarch 2026', '13/2026', 'January', '26', 'January 26'])('refuses %s', (text) => expect(parseMonthYear(text)).toBeNull())
})
