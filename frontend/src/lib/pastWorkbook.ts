import { PAST_COLUMNS, PAST_HELP, PAST_SHEETS, type PastRow, type PastSheet, type PastWorkbook } from '@bis/shared'

const text = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return value === null || value === undefined ? '' : String(value).trim()
}

// Reads an .xlsx file into the rows the server checks. Sheets and columns are found by name, in any order.
export async function readPastWorkbook(file: Blob): Promise<PastWorkbook['sheets']> {
  const { default: readExcelFile } = await import('read-excel-file/browser')
  const found = await readExcelFile(file)
  const sheets: PastWorkbook['sheets'] = {}
  for (const name of PAST_SHEETS) {
    const sheet = found.find((s) => s.sheet.trim().toLowerCase() === name.toLowerCase())
    if (!sheet) continue
    const [header = [], ...body] = sheet.data
    const columns = header.map((h) => text(h).toLowerCase().replace(/\s+/g, '_'))
    sheets[name] = body.map((row) => {
      const out: PastRow = {}
      columns.forEach((column, i) => {
        if (column) out[column] = text(row[i])
      })
      return out
    })
  }
  return sheets
}

// The empty workbook to fill in: a page of instructions, then one sheet per kind of row with its column titles
export async function pastTemplate(): Promise<Blob> {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const bold = { fontWeight: 'bold' as const }
  const sheets = [
    {
      sheet: 'Read me',
      data: [
        [{ value: 'Past competition', ...bold }],
        [{ value: 'Fill in the sheets after this one and upload the file. Only Competition and Events are always needed.' }],
        [],
        ...PAST_SHEETS.map((name) => [{ value: name, ...bold }, { value: PAST_HELP[name] }]),
        [],
        [{ value: 'Rounds', ...bold }, { value: 'round_1, round_2, quarter_final, semi_final, final' }],
        [{ value: 'Dances', ...bold }, { value: 'samba, cha_cha_cha, rumba, paso_doble, jive, waltz, tango, viennese_waltz, foxtrot, quickstep' }],
      ],
      columns: [{ width: 16 }, { width: 120 }],
    },
    ...PAST_SHEETS.map((name: PastSheet) => ({
      sheet: name,
      data: [PAST_COLUMNS[name].map((column) => ({ value: column, ...bold }))],
      columns: PAST_COLUMNS[name].map(() => ({ width: 16 })),
      stickyRowsCount: 1,
    })),
  ]
  return writeExcelFile(sheets).toBlob()
}
