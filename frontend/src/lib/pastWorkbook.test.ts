import { PAST_SHEETS } from '@bis/shared'
import writeExcelFile from 'write-excel-file/browser'
import { describe, expect, it } from 'vitest'
import { pastTemplate, readPastWorkbook } from './pastWorkbook.ts'

describe('the past competition workbook', () => {
  it('reads back the sheets and columns of its own template, empty', async () => {
    const sheets = await readPastWorkbook(await pastTemplate())
    expect(Object.keys(sheets).sort()).toEqual([...PAST_SHEETS].sort())
    expect(Object.values(sheets).every((rows) => rows.length === 0)).toBe(true)
  })

  it('reads a filled sheet by its column titles, in any order, with numbers and dates as text', async () => {
    const file = await writeExcelFile([
      { sheet: 'competition', data: [['Date', 'Name'].map((value) => ({ value })), [{ value: new Date(Date.UTC(2019, 2, 16)), format: 'yyyy-mm-dd' }, { value: 'Old Open' }]] },
      { sheet: 'Competitors', data: [['Back number', 'name_1'].map((value) => ({ value })), [{ value: 12 }, { value: ' Ana ' }]] },
    ]).toBlob()
    const sheets = await readPastWorkbook(file)
    expect(sheets.Competition).toEqual([{ date: '2019-03-16', name: 'Old Open' }])
    expect(sheets.Competitors).toEqual([{ back_number: '12', name_1: 'Ana' }])
  })
})
