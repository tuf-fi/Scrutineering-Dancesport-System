import { useMemo } from 'react'
import { categoriesOf, rankCategory, type CategoryFilter } from '../lib/rankings.ts'
import { useRankingPoints } from './index.ts'

export interface Standing extends CategoryFilter {
  competitorId: string
  rank: number
  of: number
  points: number
}

// Where each of these competitors stands in every category they have points in, best points first
export function useStandings(competitorIds: string[]): { standings: Standing[]; loading: boolean } {
  const points = useRankingPoints()
  const key = competitorIds.join('|')
  const standings = useMemo<Standing[]>(() => {
    const all = points.data ?? []
    return competitorIds
      .flatMap((competitorId) =>
        categoriesOf(all, competitorId).flatMap((category) => {
          const rows = rankCategory(all, category)
          const mine = rows.find((r) => r.competitorId === competitorId)
          return mine ? [{ ...category, competitorId, rank: mine.rank, of: rows.length, points: mine.points }] : []
        }),
      )
      .sort((a, b) => b.points - a.points)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.data, key])
  return { standings, loading: points.isLoading }
}
