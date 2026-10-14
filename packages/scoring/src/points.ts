import type { Id, PointsRow, RoundType } from '@bis/shared'
import type { EliminatedPlace } from './eliminated.ts'

// Ranking points from the admin's editable points table; no values are fixed here.

export interface PlacedCompetitor {
  competitorId: Id
  // Average of the shared places, and the best place of the range
  place: number
  announcedPlace: number
}

export interface CompetitorPoints {
  competitorId: Id
  points: number
}

// TODO: confirm against the WDSF ranking regulations. Competitors who share places split the
// points of every place they cover equally, e.g. a tie for 2nd and 3rd gets (8 + 6) / 2 each.
function pointsForRange(table: PointsRow[], from: number, count: number): number {
  let total = 0
  for (let place = from; place < from + count; place++) {
    total += table.find((row) => row.place === place)?.points ?? 0
  }
  return total / count
}

export function rankingPoints(
  table: PointsRow[],
  finalists: PlacedCompetitor[],
  eliminated: EliminatedPlace[] = [],
): CompetitorPoints[] {
  const semiFinal = table.find((row) => row.place === null)?.points ?? 0
  const earned: CompetitorPoints[] = finalists.map(({ competitorId, place, announcedPlace }) => {
    // A shared place covers announcedPlace up to the mirror of the average
    const count = Math.round((place - announcedPlace) * 2) + 1
    return { competitorId, points: pointsForRange(table, announcedPlace, count) }
  })
  for (const e of eliminated) {
    const semi: RoundType = 'semi_final'
    earned.push({ competitorId: e.competitorId, points: e.roundType === semi ? semiFinal : 0 })
  }
  return earned
}
