import { pickCurrentCompetition } from '@bis/shared'
import { useMemo } from 'react'
import { useCompetitions } from './queries.ts'

// The competition that PINs and panels belong to: the one happening now (the same rule the server uses)
// until someone picks another
export function useCompetitionChoice(chosen: string | null) {
  const competitions = useCompetitions()
  const list = useMemo(
    () => [...(competitions.data ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [competitions.data],
  )
  const valid = chosen !== null && list.some((c) => c.id === chosen)
  return { list, competitionId: valid ? chosen : pickCurrentCompetition(list)?.id }
}
