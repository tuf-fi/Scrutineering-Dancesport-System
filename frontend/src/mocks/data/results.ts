import type { PointsRow, RankingPoint, Result } from '@bis/shared'
import { currentCompetitionId } from './competitions.ts'
import { entries } from './entries.ts'
import { events } from './events.ts'
import { completedResults } from './progress.ts'
import { at, createRng, shuffle } from './rng.ts'

// Starting table from ROLES_README, pending client approval
export const pointsTable: PointsRow[] = [
  { place: 1, label: '1st', points: 10 },
  { place: 2, label: '2nd', points: 8 },
  { place: 3, label: '3rd', points: 6 },
  { place: 4, label: '4th', points: 5 },
  { place: 5, label: '5th', points: 4 },
  { place: 6, label: '6th', points: 3 },
  { place: 7, label: '7th (7-competitor final)', points: 2 },
  { place: null, label: 'Semi-final', points: 1 },
]

const FINAL_SIZE = 6
const SEMI_SIZE = 12

const rng = createRng(99)

// Past competitions keep results only; their marks are not part of the sample
const pastResults: Result[] = events
  .filter((e) => e.competitionId !== currentCompetitionId)
  .flatMap((event) => {
    const field = shuffle(
      entries.filter((e) => e.eventId === event.id).map((e) => e.competitorId),
      rng,
    )
    return field.map((competitorId, i) => ({
      id: `res:${event.id}:${competitorId}`,
      eventId: event.id,
      competitorId,
      place: i < FINAL_SIZE ? i + 1 : i < SEMI_SIZE ? FINAL_SIZE + 1 : SEMI_SIZE + 1,
      approvedBy: 'staff-scrutineer',
      approvedAt: at(-200_000),
    }))
  })

export const results: Result[] = [...completedResults, ...pastResults]

function pointsFor(place: number): number {
  if (place <= FINAL_SIZE) return pointsTable.find((r) => r.place === place)?.points ?? 0
  // Knocked out in the semi-final
  return place === FINAL_SIZE + 1 ? (pointsTable.find((r) => r.place === null)?.points ?? 0) : 0
}

const eventById = new Map(events.map((e) => [e.id, e]))

export const rankingPoints: RankingPoint[] = results.flatMap((r) => {
  const event = eventById.get(r.eventId)
  const points = pointsFor(r.place)
  if (!event || points === 0) return []
  return [
    {
      id: `rp:${r.id}`,
      competitorId: r.competitorId,
      ageGroup: event.ageGroup,
      class: event.class,
      discipline: event.discipline,
      competitionId: event.competitionId,
      points,
    },
  ]
})
