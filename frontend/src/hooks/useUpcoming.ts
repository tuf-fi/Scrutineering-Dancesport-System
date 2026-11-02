import type { Competition } from '@bis/shared'
import { todayIso } from '../lib/format.ts'
import { useCompetitions } from './queries.ts'

export interface UpcomingCompetitions {
  // Competitions from today on, soonest first; with none coming up, the most recent one stands in
  list: Competition[]
  upcoming: boolean
  // The latest competition dated today or earlier: where results and the floor live
  recent: Competition | undefined
}

export function useUpcomingCompetitions(): UpcomingCompetitions | undefined {
  const { data } = useCompetitions()
  if (!data) return undefined
  const today = todayIso()
  const coming = data.filter((c) => c.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const recent = data.filter((c) => c.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0]
  if (coming.length > 0) return { list: coming, upcoming: true, recent }
  return { list: [...data].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 1), upcoming: false, recent }
}
