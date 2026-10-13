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

function xTotals(roundId: string): Map<string, number> {
  const totals = new Map<string, number>()
  for (const m of visibleMarks(roundId)) {
    if (m.kind === 'x') totals.set(m.competitorId, (totals.get(m.competitorId) ?? 0) + 1)
  }
  return totals
}

export function recallTable(roundId: string): RecallTable {
  const round = roundOf(roundId)
  if (round.recallNumber === null) throw new Error('A final is placed, not recalled.')
  const recall = round.recallNumber
  const totals = xTotals(roundId)
  const adjudicatorIds = panels.find((p) => p.eventId === round.eventId)?.adjudicatorIds ?? []
  const submitted = new Set(visibleMarks(roundId).map((m) => m.adjudicatorId))

  const sorted = roundField(roundId)
    .map((c) => ({ competitorId: c.id, backNumber: c.backNumber, xCount: totals.get(c.id) ?? 0 }))
    .sort((a, b) => b.xCount - a.xCount || (a.backNumber ?? 0) - (b.backNumber ?? 0))

  const cutoff = sorted[recall - 1]?.xCount
  const tied = sorted.filter((r) => r.xCount === cutoff)
  const hasTie = cutoff !== undefined && sorted[recall] !== undefined && sorted[recall].xCount === cutoff
  const above = sorted.filter((r) => r.xCount > (cutoff ?? 0)).length
  const decision = hasTie ? (tieDecisions.get(roundId) ?? null) : null

  const rows: RecallRow[] = sorted.map((r, i) => {
    let outcome: RecallRow['outcome']
    if (!hasTie) outcome = i < recall ? 'recalled' : 'out'
    else if (r.xCount > cutoff) outcome = 'recalled'
    else if (r.xCount < cutoff) outcome = 'out'
    else outcome = decision ? (decision.choice === 'more' ? 'recalled' : 'out') : 'tied'
    return { ...r, names: person(r.competitorId)?.names ?? [], rank: i + 1, outcome }
  })

  return {
    roundId,
    recallNumber: recall,
    adjudicatorCount: adjudicatorIds.length,
    submittedCount: adjudicatorIds.filter((id) => submitted.has(id)).length,
    rows,
    recalled: !hasTie ? Math.min(recall, sorted.length) : decision ? (decision.choice === 'more' ? above + tied.length : above) : recall,
    tie: hasTie ? { xCount: cutoff, count: tied.length, decision } : null,
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

// TODO: the real Skating System arrives in phase 2; places here are a static sample order (lowest total wins)
export function skatingTable(roundId: string): SkatingTable {
  const round = roundOf(roundId)
  const panel = panels.find((p) => p.eventId === round.eventId)?.adjudicatorIds ?? []
  const roundMarks = visibleMarks(roundId)
  const isPlacing = roundMarks.some((m) => m.kind === 'placing') || round.recallNumber === null
  const adjudicatorList = panel.map((id) => ({ id, letter: adjudicators.find((a) => a.id === id)?.letter ?? '?' }))
  const markedBy = new Set(roundMarks.map((m) => m.adjudicatorId))

  const value = (m: Mark) => (m.kind === 'placing' ? m.placing : 1)
  const finalists = isPlacing
    ? [...new Set(roundMarks.map((m) => m.competitorId))]
    : roundField(roundId).map((c) => c.id)
  const places = isPlacing ? finalists.length : 0

  const rows: SkatingRow[] = finalists.map((competitorId) => {
    const cells: Record<string, number | null> = {}
    for (const { id } of adjudicatorList) {
      const own = roundMarks.filter((m) => m.adjudicatorId === id && m.competitorId === competitorId)
      cells[id] = markedBy.has(id) ? own.reduce((sum, m) => sum + value(m), 0) : null
    }
    const given = Object.values(cells).filter((v): v is number => v !== null)
    return {
      competitorId,
      backNumber: person(competitorId)?.backNumber ?? null,
      names: person(competitorId)?.names ?? [],
      marks: cells,
      majority: isPlacing ? Array.from({ length: places }, (_, k) => given.filter((v) => v <= k + 1).length) : [],
      total: given.reduce((a, b) => a + b, 0),
      place: 0,
    }
  })

  rows.sort((a, b) => (isPlacing ? a.total - b.total : b.total - a.total) || (a.backNumber ?? 0) - (b.backNumber ?? 0))
  rows.forEach((r, i) => (r.place = i + 1))
  return { roundId, kind: isPlacing ? 'placing' : 'x', adjudicators: adjudicatorList, places, rows }
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
