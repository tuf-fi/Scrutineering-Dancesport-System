import type { DancerDetails } from './types.ts'

// The entry form's other columns; present when any of them is filled in
export interface CompetitorCsvDetails {
  province: string
  coachName: string
  beginner: boolean
  dancers: DancerDetails[]
}

export interface CompetitorCsvRow {
  names: string[]
  clubName: string
  details?: CompetitorCsvDetails
}

// Reads CSV the way spreadsheets write it: quoted fields may hold commas, line breaks and "" for a quote
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const endCell = () => {
    row.push(cell.trim())
    cell = ''
  }
  const endRow = () => {
    endCell()
    if (row.some((c) => c !== '')) rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      endCell()
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      endRow()
    } else {
      cell += ch
    }
  }
  if (cell !== '' || row.length > 0) endRow()
  return rows
}

// Reads "Dancer, Partner, Club" lines; the partner is empty for a solo dancer. Further columns follow the entry form:
// Province, Coach, Beginner (yes or no), then for the dancer and for the partner: Date of birth, Contact no.,
// Email, Address.
export function parseCompetitorCsv(text: string): CompetitorCsvRow[] {
  const rows = parseCsv(text)
  if (rows[0]?.[0]?.toLowerCase().startsWith('dancer')) rows.shift()
  return rows.map((cells) => {
    const [first = '', second = '', club = '', province = '', coachName = '', beginner = ''] = cells
    const names = [first, second].filter(Boolean)
    const dancer = (from: number): DancerDetails => ({
      birthDate: cells[from] ?? '',
      phone: cells[from + 1] ?? '',
      email: cells[from + 2] ?? '',
      address: cells[from + 3] ?? '',
    })
    const row: CompetitorCsvRow = { names, clubName: club }
    if (cells.slice(3).some((c) => c !== '')) {
      row.details = {
        province,
        coachName,
        beginner: /^(y|yes|true|1|bgb)$/i.test(beginner),
        dancers: [dancer(6), dancer(10)].slice(0, Math.max(names.length, 1)),
      }
    }
    return row
  })
}
