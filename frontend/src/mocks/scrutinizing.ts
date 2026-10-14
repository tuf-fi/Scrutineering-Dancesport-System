import { placeFinal, tallyCallback } from '@bis/scoring'
import {
  Role,
  RoundStatus,
  type HeatAssignment,
  type Mark,
  type RecallRow,
  type RecallTable,
  type Round,
  type RoundRow,
  type SkatingRow,
  type SkatingTable,
  type TieDecision,
} from '@bis/shared'
import { roundField } from './adjudicating.ts'
import { adjudicators, panels } from './data/adjudicators.ts'
import { competitors } from './data/competitors.ts'
import { entries } from './data/entries.ts'
import { events } from './data/events.ts'
import { heats, liveRoundId, rounds } from './data/progress.ts'
import { staffUsers } from './data/staff.ts'
import { isLiveRound, liveRoundComplete, visibleMarks } from './realtime.ts'

const found = <T>(value: T | undefined, what: string): T => {
  if (value === undefined) throw new Error(`${what} not found`)
  return value
}

export const currentRoundId = () => liveRoundId

// The live round turns to review once every adjudicator has submitted
const statusOf = (round: Round): RoundStatus =>
  round.status === RoundStatus.Marking && isLiveRound(round.id) && liveRoundComplete()
    ? RoundStatus.Review
    : round.status

const roundOf = (id: string) => found(rounds.find((r) => r.id === id), 'Round')
const person = (id: string) => competitors.find((c) => c.id === id)

export function roundRows(competitionId: string): RoundRow[] {
  return rounds.flatMap((round): RoundRow[] => {
    const event = events.find((e) => e.id === round.eventId)
    if (!event || event.competitionId !== competitionId) return []
    return [
      {
        roundId: round.id,
        eventId: event.id,
        eventNumber: event.number,
        dances: event.dances,
        ageGroup: event.ageGroup,
        class: event.class,
        discipline: event.discipline,
        type: round.type,
        recallNumber: round.recallNumber,
        status: statusOf(round),
        heatCount: heats.filter((h) => h.roundId === round.id).length,
        entryCount: entries.filter((e) => e.eventId === event.id && !e.scratched).length,
      },
    ]
  })
}

export function heatAssignments(roundId: string): HeatAssignment[] {
  const existing = heats.filter((h) => h.roundId === roundId)
  if (existing.length > 0) {
    return existing.flatMap((h) => h.competitorIds.map((competitorId) => ({ competitorId, heat: h.number })))
  }
  return roundField(roundId).map((c) => ({ competitorId: c.id, heat: c.heat ?? 1 }))
}

export function saveHeatAssignments(roundId: string, assignments: HeatAssignment[]): void {
  const round = roundOf(roundId)
  const status = statusOf(round)
  if (status === RoundStatus.Approved || status === RoundStatus.Published) {
    throw new Error('Heats cannot change after the round is approved.')
  }
  const field = new Set(roundField(roundId).map((c) => c.id))
  if (assignments.length !== field.size || assignments.some((a) => !field.has(a.competitorId))) {
    throw new Error('Every competitor in the round needs a heat.')
  }
  const numbers = [...new Set(assignments.map((a) => a.heat))].sort((a, b) => a - b)
  if (numbers.some((n) => !Number.isInteger(n) || n < 1)) throw new Error('Heat numbers start at 1.')
  for (let i = heats.length - 1; i >= 0; i--) if (heats[i].roundId === roundId) heats.splice(i, 1)
  // Heats are renumbered from 1 so there are no gaps
  numbers.forEach((n, i) =>
    heats.push({
      id: `${roundId}:h${i + 1}`,
      roundId,
      number: i + 1,
      competitorIds: assignments.filter((a) => a.heat === n).map((a) => a.competitorId),
    }),
  )
}

const tieDecisions = new Map<string, TieDecision>()

const panelOf = (round: Round) => panels.find((p) => p.eventId === round.eventId)?.adjudicatorIds ?? []
const dancesIn = (list: Mark[]) => [...new Set(list.map((m) => m.dance))]

// The engine only needs the adjudicators who have submitted, so partial rounds give a provisional tally
function callbackFor(round: Round, roundId: string, recall: number) {
  const roundMarks = visibleMarks(roundId).filter((m) => m.kind === 'x')
  const field = roundField(roundId)
  const result = tallyCallback({
    competitorIds: field.map((c) => c.id),
    adjudicatorIds: panelOf(round).filter((id) => roundMarks.some((m) => m.adjudicatorId === id)),
    dances: dancesIn(roundMarks),
    recallNumber: recall,
    marks: roundMarks.map((m) => ({ adjudicatorId: m.adjudicatorId, competitorId: m.competitorId, dance: m.dance })),
  })
  return { result, field }
}

export function recallTable(roundId: string): RecallTable {
  const round = roundOf(roundId)
  if (round.recallNumber === null) throw new Error('A final is placed, not recalled.')
  const recall = round.recallNumber
  const { result, field } = callbackFor(round, roundId, recall)
  const adjudicatorIds = panelOf(round)
  const submitted = new Set(visibleMarks(roundId).map((m) => m.adjudicatorId))
  const backNumber = new Map(field.map((c) => [c.id, c.backNumber]))
  const decision = result.tie ? (tieDecisions.get(roundId) ?? null) : null

  // A round that is already decided has its recall in the next round's heats, whatever the counts say
  const sequence = rounds.filter((r) => r.eventId === round.eventId)
  const nextRound = sequence[sequence.indexOf(round) + 1]
  const decided = round.status === RoundStatus.Approved || round.status === RoundStatus.Published
  const through = decided && nextRound
    ? new Set(heats.filter((h) => h.roundId === nextRound.id).flatMap((h) => h.competitorIds))
    : null
  const settled = through !== null && through.size > 0

  const rows: RecallRow[] = [...result.rows]
    .sort((a, b) => b.xCount - a.xCount || (backNumber.get(a.competitorId) ?? 0) - (backNumber.get(b.competitorId) ?? 0))
    .map((r, i) => {
      let outcome = r.outcome
      if (settled) outcome = through.has(r.competitorId) ? 'recalled' : 'out'
      else if (r.outcome === 'tied' && decision) outcome = decision.choice === 'more' ? 'recalled' : 'out'
      return {
        competitorId: r.competitorId,
        backNumber: backNumber.get(r.competitorId) ?? null,
        names: person(r.competitorId)?.names ?? [],
        xCount: r.xCount,
        // Position in the list, so the cutoff line sits under the last recalled row
        rank: i + 1,
        outcome,
      }
    })

  const tie = result.tie
  return {
    roundId,
    recallNumber: recall,
    adjudicatorCount: adjudicatorIds.length,
    submittedCount: adjudicatorIds.filter((id) => submitted.has(id)).length,
    rows,
    recalled: settled
      ? through.size
      : !tie
        ? rows.filter((r) => r.outcome === 'recalled').length
        : decision
          ? decision.choice === 'more' ? tie.moreCount : tie.fewerCount
          : recall,
    tie: tie && !settled ? { xCount: tie.xCount, count: tie.competitorIds.length, decision } : null,
  }
}

function actorWithRole(actorId: string, role: string, what: string) {
  const user = staffUsers.find((s) => s.id === actorId)
  if (user?.role !== role) throw new Error(`Only the ${what} can do this.`)
  return user
}

export function proposeTie(actorId: string, roundId: string, choice: TieDecision['choice']): void {
  actorWithRole(actorId, Role.Scrutineer, 'scrutineer')
  if (!recallTable(roundId).tie) throw new Error('There is no tie to decide.')
  tieDecisions.set(roundId, { choice, proposedBy: actorId, confirmedBy: null })
}

export function confirmTie(actorId: string, roundId: string): void {
  actorWithRole(actorId, Role.Chairperson, 'chairperson')
  const decision = tieDecisions.get(roundId)
  if (!decision) throw new Error('The scrutineer has not proposed a decision yet.')
  decision.confirmedBy = actorId
}

export function skatingTable(roundId: string): SkatingTable {
  const round = roundOf(roundId)
  const panel = panelOf(round)
  const roundMarks = visibleMarks(roundId)
  const isPlacing = roundMarks.some((m) => m.kind === 'placing') || round.recallNumber === null
  const adjudicatorList = panel.map((id) => ({ id, letter: adjudicators.find((a) => a.id === id)?.letter ?? '?' }))
  const markedBy = new Set(roundMarks.map((m) => m.adjudicatorId))
  const complete = panel.length > 0 && panel.every((id) => markedBy.has(id))

  const cellsFor = (competitorId: string) => {
    const cells: Record<string, number | null> = {}
    for (const { id } of adjudicatorList) {
      const own = roundMarks.filter((m) => m.adjudicatorId === id && m.competitorId === competitorId)
      cells[id] = markedBy.has(id) ? own.reduce((sum, m) => sum + (m.kind === 'placing' ? m.placing : 1), 0) : null
    }
    return cells
  }
  const base = (competitorId: string) => {
    const marks = cellsFor(competitorId)
    return {
      competitorId,
      backNumber: person(competitorId)?.backNumber ?? null,
      names: person(competitorId)?.names ?? [],
      marks,
      total: Object.values(marks).reduce<number>((sum, v) => sum + (v ?? 0), 0),
    }
  }
  const byBackNumber = (a: SkatingRow, b: SkatingRow) => (a.backNumber ?? 0) - (b.backNumber ?? 0)

  if (!isPlacing) {
    const { result } = callbackFor(round, roundId, round.recallNumber ?? 0)
    const rows = result.rows.map<SkatingRow>((r) => ({
      ...base(r.competitorId),
      majority: [],
      place: r.rank,
      shared: false,
      dancePlaces: [],
      decidedBy: null,
    }))
    rows.sort((a, b) => b.total - a.total || byBackNumber(a, b))
    return { roundId, kind: 'x', complete, adjudicators: adjudicatorList, places: 0, rows }
  }

  const placings = roundMarks.filter((m) => m.kind === 'placing')
  const finalists = [...new Set(placings.map((m) => m.competitorId))]
  if (finalists.length === 0) return { roundId, kind: 'placing', complete, adjudicators: adjudicatorList, places: 0, rows: [] }

  const dances = dancesIn(placings)
  const final = placeFinal({
    competitorIds: finalists,
    adjudicatorIds: panel.filter((id) => markedBy.has(id)),
    dances: dances.map((dance) => ({
      dance,
      marks: placings
        .filter((m) => m.dance === dance)
        .map((m) => ({ adjudicatorId: m.adjudicatorId, competitorId: m.competitorId, placing: m.kind === 'placing' ? m.placing : 0 })),
    })),
  })
  const single = dances.length === 1

  const rows = final.rows.map<SkatingRow>((r) => ({
    ...base(r.competitorId),
    // The column counts are the Skating System working; a multi-dance final shows dance places instead
    majority: single ? (final.dances[0]?.result.columns[r.competitorId] ?? []).map((c) => c.count) : [],
    place: r.announcedPlace,
    shared: r.shared,
    dancePlaces: single ? [] : final.dances.map((d) => ({ dance: d.dance, place: r.dancePlaces[d.dance] ?? 0 })),
    decidedBy: r.decidedBy,
  }))
  rows.sort((a, b) => a.place - b.place || byBackNumber(a, b))
  return { roundId, kind: 'placing', complete, adjudicators: adjudicatorList, places: single ? finalists.length : 0, rows }
}

export function approveRoundResults(actorId: string, roundId: string): void {
  actorWithRole(actorId, Role.Scrutineer, 'scrutineer')
  const round = roundOf(roundId)
  if (statusOf(round) !== RoundStatus.Review) throw new Error('Every adjudicator must submit before approving.')
  if (round.recallNumber !== null) {
    const tie = recallTable(roundId).tie
    if (tie && !tie.decision?.confirmedBy) throw new Error('Resolve the tie and get the chairperson to confirm it first.')
  }
  round.status = RoundStatus.Approved
}

export function publishRoundResults(actorId: string, roundId: string): void {
  actorWithRole(actorId, Role.Scrutineer, 'scrutineer')
  const round = roundOf(roundId)
  if (round.status !== RoundStatus.Approved) throw new Error('Approve the round before publishing it.')
  round.status = RoundStatus.Published
}
