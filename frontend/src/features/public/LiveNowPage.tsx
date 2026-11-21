import { Navigate } from 'react-router'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/index.ts'
import { useCompetitions } from '../../hooks/index.ts'
import { todayIso } from '../../lib/format.ts'
import { PublicHeader } from './PublicHeader.tsx'

// The navbar's Live board: the competition held today, or a note that there is none
export function LiveNowPage() {
  const competitions = useCompetitions()
  if (competitions.isError) return <ErrorState onRetry={() => void competitions.refetch()} />
  if (competitions.isLoading) return <Skeleton className="h-24 w-full max-w-xl" />

  const today = todayIso()
  const live = (competitions.data ?? []).find((c) => c.date === today)
  if (live) return <Navigate to={`/live/${live.id}`} replace />

  return (
    <div className="flex flex-col gap-8">
      <PublicHeader title="Live board" />
      <EmptyState title="No ongoing competition" description="The live board appears here on the day of a competition." />
    </div>
  )
}
