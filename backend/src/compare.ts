import type { Sqlite } from './db/client.ts'

// Checks BIS against the result sheets the current method produced, for the pilot. The sheets are typed into a CSV:
//   event,place,back_number        (place as announced; a shared 13th to 18th is written 13 for each)
export interface Difference {
  event: number
  backNumber: number
  paper: number | null
  bis: number | null
}

export interface Comparison {
  events: number
  lines: number
  matching: number
  differences: Difference[]
  // Lines of the CSV that could not be read
  unreadable: string[]
}

export function compareResults(sqlite: Sqlite, competitionId: string, csv: string): Comparison {
  const paper = new Map<string, number>()
  const unreadable: string[] = []
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  for (const [i, line] of lines.entries()) {
    const cells = line.split(',').map((c) => c.trim())
    if (i === 0 && /[a-z]/i.test(cells[0] ?? '')) continue
    const [event, place, back] = cells.map((c) => (/^\d+$/.test(c ?? '') ? Number(c) : NaN))
    if ([event, place, back].some(Number.isNaN)) {
      unreadable.push(line)
      continue
    }
    paper.set(`${event}:${back}`, place!)
  }

  const bis = new Map<string, number>()
  const rows = sqlite
    .prepare(
      `SELECT ev.number AS event, c.back_number AS back, r.place_from AS place
       FROM results r JOIN events ev ON ev.id = r.event_id JOIN competitors c ON c.id = r.competitor_id
       WHERE ev.competition_id = ? AND c.back_number IS NOT NULL`,
    )
    .all(competitionId) as Array<{ event: number; back: number; place: number }>
  for (const r of rows) bis.set(`${r.event}:${r.back}`, r.place)

  // Only events the paper sheets cover are compared; BIS may have more
  const covered = new Set([...paper.keys()].map((k) => Number(k.split(':')[0])))
  const differences: Difference[] = []
  let matching = 0
  for (const key of new Set([...paper.keys(), ...[...bis.keys()].filter((k) => covered.has(Number(k.split(':')[0])))])) {
    const [event, back] = key.split(':').map(Number) as [number, number]
    const p = paper.get(key) ?? null
    const b = bis.get(key) ?? null
    if (p === b) matching++
    else differences.push({ event, backNumber: back, paper: p, bis: b })
  }
  differences.sort((a, b) => a.event - b.event || a.backNumber - b.backNumber)
  return { events: covered.size, lines: paper.size, matching, differences, unreadable }
}
