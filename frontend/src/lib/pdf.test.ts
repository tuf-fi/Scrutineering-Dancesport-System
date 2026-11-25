import { describe, expect, it } from 'vitest'
import { pageSlices } from './pdf.ts'

describe('pageSlices', () => {
  it('keeps a sheet that fits on one page', () => {
    expect(pageSlices(200, 297, [50, 100])).toEqual([{ start: 0, end: 200 }])
  })

  it('breaks under the last whole row, never through one', () => {
    const rows = Array.from({ length: 50 }, (_, i) => (i + 1) * 10)
    expect(pageSlices(510, 297, rows)).toEqual([
      { start: 0, end: 280 },
      { start: 280, end: 510 },
    ])
  })

  it('still moves on when nothing marks a row', () => {
    expect(pageSlices(500, 297, [])).toEqual([
      { start: 0, end: 285 },
      { start: 285, end: 500 },
    ])
  })
})
