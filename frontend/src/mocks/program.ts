import {
  PROGRAM_START,
  ProgramKind,
  ProgramStatus,
  RoundStatus,
  RoundType,
  clockTime,
  programStatuses,
  type Program,
  type ProgramRow,
  type ProgramSlotInput,
} from '@bis/shared'
import { adjudicators, panels } from './data/adjudicators.ts'
import { entries } from './data/entries.ts'
import { events } from './data/events.ts'
import { planRounds, rounds } from './data/progress.ts'
import { currentRoundId } from './scrutinizing.ts'

// The sample running order, kept in memory like the rest of the sample data
interface Slot {
  id: string
  kind: ProgramKind
  eventId: string | null
  roundType: RoundType | null
  label: string | null
  minutes: number
}

const slots = new Map<string, Slot[]>()
const starts = new Map<string, string | null>()

const ROUND_ORDER: RoundType[] = [RoundType.Round1, RoundType.Round2, RoundType.QuarterFinal, RoundType.SemiFinal, RoundType.Final]
// WDSF rules: at most 2 minutes of music per dance and 10 couples a heat before the final, plus a minute per heat
const defaultMinutes = (type: RoundType, dances: number, couples: number) =>
  (type === RoundType.Final ? 1 : Math.max(1, Math.ceil(couples / 10))) * (Math.max(1, dances) * 2 + 1)
const slotsOf = (competitionId: string) => slots.get(competitionId) ?? slots.set(competitionId, []).get(competitionId)!
const find = (slotId: string) => {
  for (const [competitionId, list] of slots) {
    const slot = list.find((s) => s.id === slotId)
    if (slot) return { competitionId, list, slot }
  }
  throw new Error('Program line not found')
}
const minutesOf = (value: unknown) => {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 600) throw new Error('Minutes is a whole number from 1 to 600.')
  return value as number
}

function fieldFor(eventId: string, type: RoundType) {
  const entered = entries.filter((e) => e.eventId === eventId && !e.scratched).length
  const saved = rounds.filter((r) => r.eventId === eventId)
  const list = saved.length > 0 ? saved.map((r) => ({ type: r.type, recall: r.recallNumber })) : planRounds(entered)
  const i = list.findIndex((r) => r.type === type)
  if (i < 0) return { entryCount: 0, recallNumber: null }
  return { entryCount: i === 0 ? entered : (list[i - 1]!.recall ?? 0), recallNumber: list[i]!.recall }
}

export function programOf(competitionId: string): Program {
  const start = starts.get(competitionId) ?? null
  const list = slotsOf(competitionId)
  const states = list.map((slot) => {
    if (slot.kind !== ProgramKind.Round) return null
    const round = rounds.find((r) => r.eventId === slot.eventId && r.type === slot.roundType)
    if (round && (round.status === RoundStatus.Approved || round.status === RoundStatus.Published)) return ProgramStatus.Completed
    if (round && round.id === currentRoundId()) return ProgramStatus.Current
    return ProgramStatus.Upcoming
  })
  const status = programStatuses(states)

  let elapsed = 0
  const rows = list.map<ProgramRow>((slot, i) => {
    const event = slot.eventId ? events.find((e) => e.id === slot.eventId) : undefined
    const field = event && slot.roundType ? fieldFor(event.id, slot.roundType) : null
    const panel = event ? (panels.find((p) => p.eventId === event.id)?.adjudicatorIds ?? []) : []
    const row: ProgramRow = {
      slotId: slot.id,
      sequence: i + 1,
      kind: slot.kind,
      startTime: start ? clockTime(start, elapsed) : null,
      minutes: slot.minutes,
      label: slot.label,
      eventId: event?.id ?? null,
      eventNumber: event?.number ?? null,
      ageGroup: event?.ageGroup ?? null,
      class: event?.class ?? null,
      discipline: event?.discipline ?? null,
      isSolo: event?.isSolo ?? null,
      dances: event?.dances ?? [],
      roundType: slot.roundType,
      recallNumber: field?.recallNumber ?? null,
      entryCount: field?.entryCount ?? 0,
      panel: adjudicators.filter((a) => panel.includes(a.id)).map((a) => a.letter).sort(),
      status: status[i]!,
    }
    elapsed += slot.minutes
    return row
  })
  return { start, rows }
}

export function setStart(competitionId: string, start: string | null): Program {
  if (start !== null && !PROGRAM_START.test(start)) throw new Error('The start time is hours and minutes, like 08:30.')
  starts.set(competitionId, start)
  return programOf(competitionId)
}

export function generate(competitionId: string): Program {
  const list = slotsOf(competitionId)
  const has = new Set(list.filter((s) => s.kind === ProgramKind.Round).map((s) => `${s.eventId}:${s.roundType}`))
  const missing = events
    .filter((e) => e.competitionId === competitionId)
    .sort((a, b) => a.number - b.number)
    .flatMap((event) => {
      const saved = rounds.filter((r) => r.eventId === event.id).map((r) => r.type)
      const types = saved.length > 0 ? saved : planRounds(entries.filter((e) => e.eventId === event.id && !e.scratched).length).map((p) => p.type)
      return types.map((type, i) => ({ event, type, order: event.number * 10 + i }))
    })
    .filter(({ event, type }) => !has.has(`${event.id}:${type}`))
    .sort((a, b) => ROUND_ORDER.indexOf(a.type) - ROUND_ORDER.indexOf(b.type) || a.order - b.order)
  for (const { event, type } of missing) {
    list.push({ id: `slot-${event.id}-${type}`, kind: ProgramKind.Round, eventId: event.id, roundType: type, label: null, minutes: defaultMinutes(type, event.dances.length, entries.filter((e) => e.eventId === event.id && !e.scratched).length) })
  }
  return programOf(competitionId)
}

export function addBreak(competitionId: string, input: { kind: ProgramKind; label: string; minutes: number; afterSequence?: number }): Program {
  if (input.kind !== ProgramKind.Break && input.kind !== ProgramKind.Awarding) throw new Error('Choose a break or the awarding.')
  const label = input.label.trim()
  if (!label) throw new Error('Give it a name, like Lunch.')
  const list = slotsOf(competitionId)
  const at = Number.isInteger(input.afterSequence) ? Math.min(Math.max(input.afterSequence!, 0), list.length) : list.length
  list.splice(at, 0, { id: `slot-${crypto.randomUUID()}`, kind: input.kind, eventId: null, roundType: null, label, minutes: minutesOf(input.minutes) })
  return programOf(competitionId)
}

export function updateSlot(slotId: string, input: ProgramSlotInput): Program {
  const { competitionId, slot } = find(slotId)
  if (input.minutes !== undefined) slot.minutes = minutesOf(input.minutes)
  if (input.label !== undefined) {
    if (slot.kind === ProgramKind.Round) throw new Error('A round is named by its event.')
    if (!input.label.trim()) throw new Error('Give it a name, like Lunch.')
    slot.label = input.label.trim()
  }
  return programOf(competitionId)
}

export function moveSlot(slotId: string, direction: 'up' | 'down'): Program {
  const { competitionId, list, slot } = find(slotId)
  const from = list.indexOf(slot)
  const to = direction === 'up' ? from - 1 : from + 1
  if (to < 0 || to >= list.length) throw new Error('That line cannot move further.')
  ;[list[from], list[to]] = [list[to]!, list[from]!]
  return programOf(competitionId)
}

export function removeSlot(slotId: string): Program {
  const { competitionId, list, slot } = find(slotId)
  list.splice(list.indexOf(slot), 1)
  return programOf(competitionId)
}
