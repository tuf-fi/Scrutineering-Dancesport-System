import { Link } from 'react-router'
import { useCompetitorActivity } from '../hooks/useAthlete.ts'
import { useStandings } from '../hooks/useStandings.ts'
import { cn } from '../lib/cn.ts'
import { DISCIPLINE_LABEL } from '../lib/format.ts'
import { EntriesByCompetition } from './EntriesByCompetition.tsx'
import { ResultsByCompetition } from './ResultsByCompetition.tsx'
import { EmptyState, Skeleton } from './ui/index.ts'
import { useCatalog } from '../hooks/index.ts'

// Where a competitor stands in each category, as short rows
function StandingsList({ competitorId }: { competitorId: string }) {
  const { ageGroupLabel } = useCatalog()
  const { standings, loading } = useStandings([competitorId])
  if (loading) return <Skeleton className="h-16 w-full" />
  if (standings.length === 0) return <EmptyState title="Not ranked yet" description="Points appear after a result in a ranked category." />
  return (
    <ul aria-label="Standings" className="border-y border-neutral-200">
      {standings.map((s) => (
        <li key={`${s.ageGroup}|${s.class}|${s.discipline}`} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-x-4 border-t border-neutral-200 py-3 first:border-t-0">
          <span className={cn('text-body font-semibold tabular-nums', s.rank <= 3 ? 'text-gold-700' : 'text-neutral-500')}>#{s.rank}</span>
          <Link to={`/standings?discipline=${s.discipline}&age=${s.ageGroup}&class=${s.class}&highlight=${s.competitorId}`} className="min-w-0 text-small text-neutral-900 hover:underline">
            {DISCIPLINE_LABEL[s.discipline]} <span aria-hidden>/</span> {ageGroupLabel(s.ageGroup)} <span aria-hidden>/</span> {s.class}
            <span className="ml-2 text-neutral-500">of {s.of}</span>
          </Link>
          <span className="flex items-baseline gap-1.5">
            <span className="text-body font-semibold tabular-nums text-neutral-900">{s.points}</span>
            <span className="font-mono text-xs uppercase text-neutral-500">pts</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export function CompetitorEntries({ competitorId }: { competitorId: string }) {
  const activity = useCompetitorActivity(competitorId)
  return <EntriesByCompetition entries={activity.data?.entries ?? []} loading={activity.isLoading} label="Entries" empty={{ title: 'No entries yet' }} compact />
}

export function CompetitorResults({ competitorId }: { competitorId: string }) {
  const activity = useCompetitorActivity(competitorId)
  return <ResultsByCompetition lines={activity.data?.results ?? []} loading={activity.isLoading} label="Results" empty={{ title: 'No results yet' }} compact />
}

export const CompetitorRankings = StandingsList
