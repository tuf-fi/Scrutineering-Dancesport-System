import { RoundType } from '@bis/shared'
import { useCompetitorRows, useResults, useRounds, useSkatingTable } from '../../hooks/index.ts'

// The placed finalists of an event, best first, with who they are; empty until the scrutineer has approved the final
export function useFinalRows(eventId: string) {
  const rounds = useRounds(eventId)
  const final = rounds.data?.find((r) => r.type === RoundType.Final)
  const results = useResults(eventId)
  const finalTable = useSkatingTable(final?.id ?? '')
  const people = useCompetitorRows()

  const finalists = new Set((finalTable.data?.rows ?? []).map((r) => r.competitorId))
  const byId = new Map((people.data ?? []).map((c) => [c.id, c]))
  // The result says which stage placed each competitor; where it does not (sample data), the final's table does
  const inFinal = (r: { stage?: string; competitorId: string }) => (r.stage ? r.stage === 'final' : finalists.has(r.competitorId))
  const rows = (results.data ?? []).filter(inFinal).sort((a, b) => a.place - b.place)

  return {
    rows,
    byId,
    failed: results.isError || finalTable.isError || people.isError,
    retry: () => void Promise.all([results.refetch(), finalTable.refetch(), people.refetch()]),
  }
}
