import type { Checked } from './catalog.ts'
import { ProgramStatus, RoundType } from './enums.ts'

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

// ---- The rounds of an event ----

// How many couples a round recalls; null for the final
export interface RoundPlanInput {
  type: RoundType
  recall: number | null
}

const ROUND_ORDER: RoundType[] = [RoundType.Round1, RoundType.Round2, RoundType.QuarterFinal, RoundType.SemiFinal, RoundType.Final]

// The rounds an event of this size starts with. The client's finals have 6 couples ("select 6"), so 7 entries already need a semi-final.
export function suggestRounds(entryCount: number): RoundPlanInput[] {
  const final = { type: RoundType.Final, recall: null }
  const semi = { type: RoundType.SemiFinal, recall: 6 }
  if (entryCount <= 6) return [final]
  if (entryCount <= 14) return [semi, final]
  if (entryCount <= 24) return [{ type: RoundType.Round1, recall: 12 }, semi, final]
  return [{ type: RoundType.Round1, recall: 24 }, { type: RoundType.Round2, recall: 12 }, semi, final]
}

// The secretariat or the scrutineer chooses the rounds: in order, ending with the final, each recalling fewer couples
export function checkRoundPlan(input: unknown): Checked<RoundPlanInput[]> {
  if (!Array.isArray(input) || input.length === 0) return { error: 'Choose at least one round.', status: 400 }
  const plan: RoundPlanInput[] = []
  let last = -1
  let before = Infinity
  for (const item of input as Array<Partial<RoundPlanInput>>) {
    const at = ROUND_ORDER.indexOf(item?.type as RoundType)
    if (at < 0) return { error: 'Choose a valid round.', status: 400 }
    if (at <= last) return { error: 'Rounds come in order, each one once: Round 1, Round 2, Quarter-final, Semi-final, Final.', status: 400 }
    last = at
    if (item.type === RoundType.Final) {
      plan.push({ type: RoundType.Final, recall: null })
      continue
    }
    const recall = item.recall
    if (!Number.isInteger(recall) || (recall as number) < 1 || (recall as number) > 500) return { error: 'Couples recalled is a whole number from 1.', status: 400 }
    if ((recall as number) >= before) return { error: 'Each round recalls fewer couples than the one before.', status: 400 }
    before = recall as number
    plan.push({ type: item.type as RoundType, recall: recall as number })
  }
  if (plan[plan.length - 1]!.type !== RoundType.Final) return { error: 'The last round is the final.', status: 400 }
  return { values: plan }
}
