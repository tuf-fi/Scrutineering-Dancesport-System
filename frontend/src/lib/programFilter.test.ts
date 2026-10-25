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

describe('filterProgram for my entries', () => {
  const mine = (id: string, eventId: string) => ({ ...round(1, 'final'), slotId: id, eventId }) as ProgramRow
  const list = [mine('a', 'e1'), lunch, mine('b', 'e2'), mine('c', 'e3')]

  it('keeps only the events given, and the breaks', () => {
    expect(filterProgram(list, '', 'all', new Set(['e2', 'e3'])).map((r) => r.slotId)).toEqual(['b1', 'b', 'c'])
    expect(filterProgram(list, '', 'all', new Set()).map((r) => r.slotId)).toEqual(['b1'])
  })

  it('shows everything when no back number is set', () => {
    expect(filterProgram(list, '', 'all', null)).toHaveLength(4)
  })
})

describe('programPrintPath', () => {
  it('carries only the filters that are set', () => {
    expect(programPrintPath('c1', '', 'all')).toBe('/competitions/c1/program/print')
    expect(programPrintPath('c1', ' Samba ', 'final', true)).toBe('/competitions/c1/program/print?q=Samba&round=final&pdf=1')
    expect(programPrintPath('c1', '', 'all', false, ' 42 ')).toBe('/competitions/c1/program/print?back=42')
  })
})
