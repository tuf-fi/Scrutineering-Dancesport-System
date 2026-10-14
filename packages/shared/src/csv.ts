export interface CompetitorCsvRow {
  names: string[]
  clubName: string
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

// Reads "Dancer 1, Dancer 2, Club" lines; the second column is empty for a solo dancer
export function parseCompetitorCsv(text: string): CompetitorCsvRow[] {
  const rows = parseCsv(text)
  if (rows[0]?.[0]?.toLowerCase().startsWith('dancer')) rows.shift()
  return rows.map(([first = '', second = '', club = '']) => ({
    names: [first, second].filter(Boolean),
    clubName: club,
  }))
}
