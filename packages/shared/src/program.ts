import { ProgramStatus } from './enums.ts'

export const PROGRAM_START = /^([01]\d|2[0-3]):[0-5]\d$/

// The clock time "plusMinutes" after a start given as "HH:MM"; wraps past midnight
export function clockTime(start: string, plusMinutes: number): string {
  const [h, m] = start.split(':').map(Number) as [number, number]
  const total = (h * 60 + m + plusMinutes) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// Each line's status from the state of its round: null for a break or the awarding, which have no round.
// A break is over once a later round has started, and the first line still to come after the current one is next.
export function programStatuses(rounds: Array<ProgramStatus | null>): ProgramStatus[] {
  let lastDone = -1
  rounds.forEach((s, i) => {
    if (s === ProgramStatus.Completed || s === ProgramStatus.Current) lastDone = i
  })
  const status = rounds.map((s, i) => s ?? (i < lastDone ? ProgramStatus.Completed : ProgramStatus.Upcoming))
  const next = status.findIndex((s, i) => s === ProgramStatus.Upcoming && i > status.indexOf(ProgramStatus.Current))
  if (next >= 0) status[next] = ProgramStatus.Next
  return status
}
