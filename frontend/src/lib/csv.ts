export interface CompetitorCsvRow {
  names: string[]
  clubName: string
}

// Reads "Dancer 1, Dancer 2, Club" lines; the second column is empty for a solo dancer
// TODO: quoted fields with commas are not handled; the backend parser will cover them
export function parseCompetitorCsv(text: string): CompetitorCsvRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  const rows = lines.map((line) => line.split(',').map((cell) => cell.trim()))
  if (rows[0]?.[0].toLowerCase().startsWith('dancer')) rows.shift()
  return rows.map(([first = '', second = '', club = '']) => ({
    names: [first, second].filter(Boolean),
    clubName: club,
  }))
}
