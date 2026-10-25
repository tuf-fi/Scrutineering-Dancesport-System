import type { ProgramRow } from '@bis/shared'
import { describe, expect, it } from 'vitest'
import { filterProgram, programPrintPath } from './programFilter.ts'

const round = (n: number, type: ProgramRow['roundType']): ProgramRow =>
  ({ slotId: `r${n}`, kind: 'round', eventNumber: n, ageGroup: 'junior_1', class: 'E1', discipline: 'latin', dances: ['samba'], roundType: type, label: null }) as ProgramRow
const lunch = { slotId: 'b1', kind: 'break', eventNumber: null, ageGroup: null, class: null, discipline: null, dances: [], roundType: null, label: 'Lunch' } as unknown as ProgramRow
const rows = [round(1, 'semi_final'), lunch, round(2, 'final')]

describe('filterProgram', () => {
  it('keeps breaks when a round is chosen, since they still say when things happen', () => {
    expect(filterProgram(rows, '', 'final').map((r) => r.slotId)).toEqual(['b1', 'r2'])
  })

  it('searches the break name too, and shows everything with no filter', () => {
    expect(filterProgram(rows, 'lunch', 'all').map((r) => r.slotId)).toEqual(['b1'])
    expect(filterProgram(rows, '', 'all')).toHaveLength(3)
  })
})

describe('programPrintPath', () => {
  it('carries only the filters that are set', () => {
    expect(programPrintPath('c1', '', 'all')).toBe('/competitions/c1/program/print')
    expect(programPrintPath('c1', ' Samba ', 'final', true)).toBe('/competitions/c1/program/print?q=Samba&round=final&pdf=1')
  })
})
