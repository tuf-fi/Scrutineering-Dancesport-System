import { ProgramKind, ProgramStatus, type Announcement, type Program, type RoundType } from '@bis/shared'

export interface ShowRound {
  key: string
  eventNumber: number
  roundType: RoundType
  sample: Announcement
  // Every heat called, in order (a redance is not a heat of its own)
  heats: Announcement[]
  recall: Announcement | undefined
  finalists: Announcement | undefined
  results: Announcement[]
}

export const roundKey = (a: Pick<Announcement, 'eventNumber' | 'roundType'>) => `${a.eventNumber}:${a.roundType}`

// The slides grouped by round, in the order the show runs them
export function showRounds(items: Announcement[]): ShowRound[] {
  const map = new Map<string, ShowRound>()
  for (const a of items) {
    const key = roundKey(a)
    const round = map.get(key) ?? { key, eventNumber: a.eventNumber, roundType: a.roundType, sample: a, heats: [], recall: undefined, finalists: undefined, results: [] }
    if (a.kind === 'call' && !a.redance) round.heats.push(a)
    else if (a.kind === 'recall') round.recall = a
    else if (a.kind === 'finalists') round.finalists = a
    else if (a.kind === 'result') round.results.push(a)
    map.set(key, round)
  }
  return [...map.values()]
}

// The slide the show is at when the announcer has not moved yet: the first call of the first round not yet done
export function firstOpenCall(items: Announcement[], program: Program | undefined): number {
  const done = new Set(
    (program?.rows ?? [])
      .filter((r) => r.kind === ProgramKind.Round && r.status === ProgramStatus.Completed && r.eventNumber !== null && r.roundType)
      .map((r) => `${r.eventNumber}:${r.roundType}`),
  )
  const open = items.findIndex((a) => a.kind === 'call' && !done.has(roundKey(a)))
  return open >= 0 ? open : Math.max(0, items.findIndex((a) => a.kind === 'call'))
}
