import {
  type AdjudicatorState,
  type DemoRound,
  type Mark,
  type MarkingTask,
  type MarkSubmission,
  type Round,
} from '@bis/shared'
import { panels } from './data/adjudicators.ts'
import { competitors } from './data/competitors.ts'
import { entries } from './data/entries.ts'
import { currentEvents, featuredEvent } from './data/events.ts'
import { heats, liveRoundId, marks, roundFields, rounds } from './data/progress.ts'

const MAX_HEAT = 12

// TODO: the venue server decides which round is on the floor; here a demo pointer stands in for the scrutineer
let activeRoundId: string | null = liveRoundId
// "adjudicator:round" pairs already submitted
const submitted = new Set<string>()

const key = (adjudicatorId: string, roundId: string) => `${adjudicatorId}:${roundId}`

function roundsOf(eventId: string): Round[] {
  return rounds.filter((r) => r.eventId === eventId)
}

// The competitors in a round: its heats when it has them, otherwise the previous round's recall
function fieldOf(round: Round): MarkingTask['competitors'] {
  const backNumber = new Map(competitors.map((c) => [c.id, c.backNumber]))
  const roundHeats = heats.filter((h) => h.roundId === round.id)
  if (roundHeats.length > 0) {
    return roundHeats.flatMap((h) =>
      h.competitorIds.map((id) => ({ id, backNumber: backNumber.get(id) ?? null, heat: h.number })),
    )
  }
  // Rounds with sample marks and no heats (the finals) keep the competitors who were actually marked
  const marked = roundFields.get(round.id)
  if (marked) {
    return marked
      .map((id) => ({ id, backNumber: backNumber.get(id) ?? null, heat: null }))
      .sort((a, b) => (a.backNumber ?? Infinity) - (b.backNumber ?? Infinity))
  }
  const sequence = roundsOf(round.eventId)
  const previous = sequence[sequence.indexOf(round) - 1]
  // TODO: the real field is who the previous round recalled; the sample takes the lowest back numbers
  const active = entries
    .filter((e) => e.eventId === round.eventId && !e.scratched)
    .map((e) => e.competitorId)
    .sort((a, b) => (backNumber.get(a) ?? Infinity) - (backNumber.get(b) ?? Infinity))
  const field = previous?.recallNumber ? active.slice(0, previous.recallNumber) : active
  return field.map((id, i) => ({
    id,
    backNumber: backNumber.get(id) ?? null,
    heat: round.recallNumber === null ? null : Math.floor(i / MAX_HEAT) + 1,
  }))
}

export function taskFor(roundId: string): MarkingTask | null {
  const round = rounds.find((r) => r.id === roundId)
  const event = currentEvents.find((e) => e.id === round?.eventId)
  if (!round || !event) return null
  return { round, event, recallNumber: round.recallNumber, dances: event.dances, competitors: fieldOf(round) }
}

// The competitors in a round, for heat setup and marks
export function roundField(roundId: string): MarkingTask['competitors'] {
  const round = rounds.find((r) => r.id === roundId)
  return round ? fieldOf(round) : []
}

export function adjudicatorState(adjudicatorId: string): AdjudicatorState {
  const task = activeRoundId ? taskFor(activeRoundId) : null
  const onPanel = panels.find((p) => p.eventId === task?.event.id)?.adjudicatorIds.includes(adjudicatorId)
  if (!task || !onPanel) return { status: 'waiting' }
  return { status: submitted.has(key(adjudicatorId, task.round.id)) ? 'submitted' : 'marking', task }
}

export function submitMarks(adjudicatorId: string, roundId: string, submissions: MarkSubmission[]): void {
  const state = adjudicatorState(adjudicatorId)
  if (state.status === 'submitted') throw new Error('You have already submitted this round.')
  if (state.status !== 'marking' || state.task.round.id !== roundId) throw new Error('This round is not open for marking.')
  const { task } = state
  const field = new Set(task.competitors.map((c) => c.id))

  for (const dance of task.dances) {
    const given = submissions.find((s) => s.dance === dance)
    if (!given) throw new Error('Mark every dance before submitting.')
    const ids = given.competitorIds
    if (new Set(ids).size !== ids.length || ids.some((id) => !field.has(id))) {
      throw new Error('Each competitor can be marked once, and only those in this round.')
    }
    if (task.recallNumber === null && ids.length !== field.size) throw new Error('Place every finalist.')
    if (task.recallNumber !== null && ids.length !== task.recallNumber) {
      throw new Error(`Mark exactly ${task.recallNumber} competitors in each dance.`)
    }
  }

  // Replace this adjudicator's earlier marks for the round, if the sample already holds some
  for (let i = marks.length - 1; i >= 0; i--) {
    if (marks[i].roundId === roundId && marks[i].adjudicatorId === adjudicatorId) marks.splice(i, 1)
  }
  const at = new Date().toISOString()
  for (const { dance, competitorIds } of submissions) {
    competitorIds.forEach((competitorId, i) => {
      const base = { id: `${roundId}:${adjudicatorId}:${dance}:${competitorId}`, roundId, adjudicatorId, competitorId, dance, submittedAt: at }
      const mark: Mark = task.recallNumber === null ? { ...base, kind: 'placing', placing: i + 1 } : { ...base, kind: 'x' }
      marks.push(mark)
    })
  }
  submitted.add(key(adjudicatorId, roundId))
}

// Rounds a demo can put on the floor, so every marking screen can be tried
export function demoRounds(): DemoRound[] {
  const couple = currentEvents.find((e) => !e.isSolo && e.dances.length > 1)
  const pick = (eventId: string | undefined, which: 'first' | 'last') => {
    const list = eventId ? roundsOf(eventId) : []
    return which === 'first' ? list[0] : list[list.length - 1]
  }
  const options: Array<[Round | undefined, string]> = [
    [rounds.find((r) => r.id === liveRoundId), 'Recall round, one dance'],
    [pick(couple?.id, 'first'), 'First round, three dances'],
    [pick(couple?.id, 'last'), 'Final, three dances'],
    [pick(featuredEvent.id, 'last'), 'Final, one dance'],
  ]
  const seen = new Set<string>()
  return options.flatMap(([round, label]) => {
    if (!round || seen.has(round.id)) return []
    seen.add(round.id)
    return [{ roundId: round.id, label }]
  })
}

export function startDemoRound(roundId: string | null): void {
  activeRoundId = roundId
  // A round put back on the floor can be marked again
  if (roundId) for (const k of [...submitted]) if (k.endsWith(`:${roundId}`)) submitted.delete(k)
}
