import { ProgramKind, type ProgramRow } from '@bis/shared'
import { AGE_GROUP_LABEL, DISCIPLINE_LABEL, eventCode, eventDances } from './format.ts'

const searchText = (r: ProgramRow) =>
  r.kind === ProgramKind.Round && r.eventNumber !== null && r.ageGroup && r.class && r.discipline
    ? `${eventCode({ number: r.eventNumber })} ${eventDances(r)} ${AGE_GROUP_LABEL[r.ageGroup]} ${r.class} ${DISCIPLINE_LABEL[r.discipline]}`
    : (r.label ?? '')

// The lines a search and a round filter leave; the screen and the printout use the same rule
export function filterProgram(rows: ProgramRow[], query: string, round: string, mine: ReadonlySet<string> | null = null): ProgramRow[] {
  const needle = query.trim().toLowerCase()
  // A break or the awarding has no round, so a round filter leaves them in: they still tell you when things happen
  // Breaks stay for "my entries" too: they are part of the day
  const isMine = (r: ProgramRow) => mine === null || r.kind !== ProgramKind.Round || (r.eventId !== null && mine.has(r.eventId))
  return rows.filter((r) => isMine(r) && (round === 'all' || r.kind !== ProgramKind.Round || r.roundType === round) && (!needle || searchText(r).toLowerCase().includes(needle)))
}

// The address of the printout for a competition, carrying the filter so paper matches the screen
export function programPrintPath(competitionId: string, query: string, round: string, pdf = false, back = ''): string {
  const params = new URLSearchParams()
  if (query.trim()) params.set('q', query.trim())
  if (round !== 'all') params.set('round', round)
  if (back.trim()) params.set('back', back.trim())
  if (pdf) params.set('pdf', '1')
  const text = params.toString()
  return `/competitions/${competitionId}/program/print${text ? `?${text}` : ''}`
}
