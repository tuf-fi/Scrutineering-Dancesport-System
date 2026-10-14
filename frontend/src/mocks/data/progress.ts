import { placeEliminated, placeFinal, rankingPoints, type RoundOutcome } from '@bis/scoring'
import {
  RoundStatus,
  RoundType,
  type Event,
  type Heat,
  type Mark,
  type Result,
  type Round,
} from '@bis/shared'
import { panels } from './adjudicators.ts'
import { competitors } from './competitors.ts'
import { completedEvent, currentEvents, featuredEvent } from './events.ts'
import { entries } from './entries.ts'
import { pointsTable } from './pointsTable.ts'
import { at, createRng } from './rng.ts'

const rng = createRng(2026)
const strength = new Map(competitors.map((c) => [c.id, rng()]))
const power = (id: string) => strength.get(id) ?? 0

const MAX_HEAT = 12

// recall is how many go through from the round; null for the final
function planRounds(entryCount: number): Array<{ type: RoundType; recall: number | null }> {
  const final = { type: RoundType.Final, recall: null }
  const semi = { type: RoundType.SemiFinal, recall: 6 }
  if (entryCount <= 7) return [final]
  if (entryCount <= 14) return [semi, final]
  if (entryCount <= 24) return [{ type: RoundType.Round1, recall: 12 }, semi, final]
  return [
    { type: RoundType.Round1, recall: 24 },
    { type: RoundType.Round2, recall: 12 },
    semi,
    final,
  ]
}

function splitHeats(roundId: string, ids: string[]): Heat[] {
  const count = Math.ceil(ids.length / MAX_HEAT)
  const size = Math.ceil(ids.length / count)
  return Array.from({ length: count }, (_, i) => ({
    id: `${roundId}:h${i + 1}`,
    roundId,
    number: i + 1,
    competitorIds: ids.slice(i * size, (i + 1) * size),
  }))
}

// Every adjudicator marks exactly `recall` competitors, favouring the stronger dancers
function xMarks(
  roundId: string,
  event: Event,
  adjudicatorIds: string[],
  field: string[],
  recall: number,
  minute: number,
): Mark[] {
  return adjudicatorIds.flatMap((adjudicatorId, i) =>
    field
      .map((id) => ({ id, score: power(id) + (rng() - 0.5) * 0.5 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, recall)
      .map(
        ({ id }): Mark => ({
          kind: 'x',
          id: `${roundId}:${adjudicatorId}:${id}`,
          roundId,
          adjudicatorId,
          competitorId: id,
          dance: event.dances[0],
          submittedAt: at(minute + i),
        }),
      ),
  )
}

// Every adjudicator uses each place from 1st to the last finalist exactly once
function placingMarks(
  roundId: string,
  event: Event,
  adjudicatorIds: string[],
  finalists: string[],
  minute: number,
): Mark[] {
  return adjudicatorIds.flatMap((adjudicatorId, i) =>
    finalists
      .map((id) => ({ id, score: power(id) + (rng() - 0.5) * 0.5 }))
      .sort((a, b) => b.score - a.score)
      .map(
        ({ id }, rank): Mark => ({
          kind: 'placing',
          placing: rank + 1,
          id: `${roundId}:${adjudicatorId}:${id}`,
          roundId,
          adjudicatorId,
          competitorId: id,
          dance: event.dances[0],
          submittedAt: at(minute + i),
        }),
      ),
  )
}

function recall(marks: Mark[], field: string[], count: number): string[] {
  const xs = new Map<string, number>()
  for (const m of marks) xs.set(m.competitorId, (xs.get(m.competitorId) ?? 0) + 1)
  return [...field]
    .sort((a, b) => (xs.get(b) ?? 0) - (xs.get(a) ?? 0) || power(b) - power(a))
    .slice(0, count)
}

interface Progress {
  rounds: Round[]
  heats: Heat[]
  marks: Mark[]
  results: Result[]
  // Ranking points by result id
  points: Map<string, number>
}

function build(event: Event, statuses: RoundStatus[], withResults: boolean): Progress {
  const active = entries.filter((e) => e.eventId === event.id && !e.scratched).map((e) => e.competitorId)
  const adjudicatorIds = panels.find((p) => p.eventId === event.id)?.adjudicatorIds ?? []
  const out: Progress = { rounds: [], heats: [], marks: [], results: [], points: new Map() }
  const outcomes: RoundOutcome[] = []
  let finalists: ReturnType<typeof placeFinal>['rows'] = []
  let field = active
  let minute = 30

  planRounds(active.length).forEach((plan, i) => {
    const status = statuses[i] ?? RoundStatus.Pending
    const round: Round = {
      id: `${event.id}:${plan.type}`,
      eventId: event.id,
      type: plan.type,
      recallNumber: plan.recall,
      status,
    }
    out.rounds.push(round)
    if (status === RoundStatus.Pending) return

    if (plan.type !== RoundType.Final) out.heats.push(...splitHeats(round.id, field))

    if (plan.recall === null) {
      const marks = placingMarks(round.id, event, adjudicatorIds, field, minute)
      out.marks.push(...marks)
      finalists = placeFinal({
        competitorIds: field,
        adjudicatorIds,
        dances: [
          {
            dance: event.dances[0],
            marks: marks.flatMap((m) =>
              m.kind === 'placing' ? [{ adjudicatorId: m.adjudicatorId, competitorId: m.competitorId, placing: m.placing }] : [],
            ),
          },
        ],
      }).rows
    } else {
      const marks = xMarks(round.id, event, adjudicatorIds, field, plan.recall, minute)
      out.marks.push(...marks)
      const next = recall(marks, field, plan.recall)
      const xCounts: Record<string, number> = {}
      for (const m of marks) xCounts[m.competitorId] = (xCounts[m.competitorId] ?? 0) + 1
      outcomes.push({ roundType: plan.type, competitorIds: field, recalledIds: next, xCounts })
      field = next
    }
    minute += 40
  })

  if (withResults) {
    // Cut competitors share a range and are stored at its best place; finalists come from the Skating System
    const eliminated = placeEliminated(outcomes)
    const placed = new Map([...eliminated, ...finalists].map((p) => [p.competitorId, p.announcedPlace]))
    out.results = [...placed].map(([competitorId, place]) => ({
      id: `res:${event.id}:${competitorId}`,
      eventId: event.id,
      competitorId,
      place,
      approvedBy: 'staff-scrutineer',
      approvedAt: at(minute),
    }))
    for (const p of rankingPoints(pointsTable, finalists, eliminated)) {
      out.points.set(`res:${event.id}:${p.competitorId}`, p.points)
    }
  }
  return out
}

const allPublished = [
  RoundStatus.Published,
  RoundStatus.Published,
  RoundStatus.Published,
  RoundStatus.Published,
]
const featured = build(
  featuredEvent,
  [RoundStatus.Published, RoundStatus.Marking, RoundStatus.Pending, RoundStatus.Pending],
  false,
)
const completed = build(completedEvent, allPublished, true)

// Round 2 of the featured event is the one whose submissions arrive live
export const liveRoundId = `${featuredEvent.id}:${RoundType.Round2}`

const detailed = new Set([featuredEvent.id, completedEvent.id])
const planned = currentEvents
  .filter((e) => !detailed.has(e.id))
  .flatMap((e) => build(e, [], false).rounds)

export const rounds: Round[] = [...featured.rounds, ...completed.rounds, ...planned]
export const heats: Heat[] = [...featured.heats, ...completed.heats]
export const marks: Mark[] = [...featured.marks, ...completed.marks]
export const completedResults: Result[] = completed.results
export const completedPoints = completed.points
// The competitors who actually danced each round, which marks and heats are built on
export const roundFields = new Map<string, string[]>(
  [featured, completed].flatMap((p) =>
    p.rounds.flatMap((r) => {
      const heated = p.heats.filter((h) => h.roundId === r.id).flatMap((h) => h.competitorIds)
      const marked = [...new Set(p.marks.filter((m) => m.roundId === r.id).map((m) => m.competitorId))]
      return heated.length > 0 ? [[r.id, heated] as [string, string[]]] : marked.length > 0 ? [[r.id, marked] as [string, string[]]] : []
    }),
  ),
)
