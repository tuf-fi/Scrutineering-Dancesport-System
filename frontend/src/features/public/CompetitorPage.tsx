import { useMemo } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Avatars } from '../../components/Avatars.tsx'
import { ResultsByCompetition } from '../../components/ResultsByCompetition.tsx'
import { Link, useLocation, useParams } from 'react-router'
import { ButtonLink, EmptyState, ErrorState, Pagination, Skeleton } from '../../components/ui/index.ts'
import { useTeams, useCompetitorHistory, useCompetitors, useRankingPoints, useCatalog } from '../../hooks/index.ts'
import { usePagination } from '../../hooks/usePagination.ts'
import { competitorName } from '../../lib/format.ts'
import { HeaderStat, HeaderStats, PublicHeader } from './PublicHeader.tsx'
import { categoriesOf, rankCategory, type CategoryFilter } from '../../lib/rankings.ts'

interface CategoryStanding extends CategoryFilter {
  rank: number
  of: number
  points: number
}

export function CompetitorPage() {
  const { eventGrade } = useCatalog()
  const { id = '' } = useParams()
  const cameFromRankings = (useLocation().state as { from?: string } | null)?.from === 'rankings'
  const competitors = useCompetitors()
  const teams = useTeams()
  const history = useCompetitorHistory(id)
  const points = useRankingPoints()

  const competitor = competitors.data?.find((c) => c.id === id)
  const team = teams.data?.find((c) => c.id === competitor?.teamId)

  const standings = useMemo<CategoryStanding[]>(() => {
    const all = points.data ?? []
    return categoriesOf(all, id)
      .flatMap((category) => {
        const rows = rankCategory(all, category)
        const mine = rows.find((r) => r.competitorId === id)
        return mine
          ? [
              {
                ...category,
                rank: mine.rank,
                of: rows.length,
                points: mine.points,
              },
            ]
          : []
      })
      .sort((a, b) => b.points - a.points)
  }, [points.data, id])

  const { page, setPage, pageSize, total, pageItems } = usePagination(standings, id)

  if (competitors.isError || history.isError || points.isError) {
    return <ErrorState onRetry={() => void Promise.all([competitors.refetch(), history.refetch(), points.refetch()])} />
  }
  if (competitors.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-14 w-72" />
        <Skeleton className="h-5 w-48" />
      </div>
    )
  }
  if (!competitor) {
    return (
      <EmptyState
        title="Competitor not found"
        description="That link doesn't match anyone on the rankings."
        action={
          <ButtonLink to="/rankings" variant="secondary">
            Back to rankings
          </ButtonLink>
        }
      />
    )
  }

  const lines = history.data ?? []
  const competitionCount = new Set(lines.map((l) => l.competitionId)).size

  return (
    <div className="flex flex-col gap-8">
      <PublicHeader
        back={cameFromRankings ? { to: '/rankings', label: 'Rankings' } : { to: '/athletes', label: 'Athletes' }}
        eyebrow="Athlete"
        title={competitorName(competitor.names)}
        description={team?.name}
        leading={<Avatars names={competitor.names} size="xxl" />}
        aside={
          <HeaderStats>
            <HeaderStat value={competitionCount} label="Competitions" />
            <HeaderStat value={lines.length} label="Results" />
            <HeaderStat value={standings.length} label="Categories" />
          </HeaderStats>
        }
      />

      <section aria-labelledby="standings" className="flex flex-col gap-4">
        <h2 id="standings" className="text-small font-bold uppercase tracking-wide text-neutral-900">
          Rankings
        </h2>
        {points.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : standings.length === 0 ? (
          <EmptyState title="Not ranked yet" description="Points appear after a result in a ranked category." />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-200 border-y border-neutral-200">
            {pageItems.map((s) => (
              <li
                key={`${s.ageGroup}|${s.class}|${s.discipline}`}
                className="group relative flex items-center justify-between gap-6 py-4 transition-colors hover:bg-gold-50 sm:px-4 sm:py-5"
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Link
                    to={`/rankings?discipline=${s.discipline}&age=${s.ageGroup}&class=${s.class}&highlight=${id}`}
                    className="font-semibold text-neutral-900 after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-gold-500"
                  >
                    {eventGrade(s)}
                  </Link>
                  <span className="font-mono text-xs uppercase tabular-nums text-neutral-600">
                    <span className={s.rank <= 3 ? 'font-semibold text-gold-700' : undefined}>Rank {s.rank}</span> of{' '}
                    {s.of}
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-[1.25rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-neutral-900">
                      {s.points}
                    </span>
                    <span className="font-mono text-xs uppercase text-neutral-600">pts</span>
                  </span>
                  <ArrowUpRight
                    aria-hidden
                    className="hidden size-6 text-neutral-400 transition duration-300 group-hover:rotate-45 group-hover:text-gold-500 sm:block"
                    strokeWidth={1.5}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        {!points.isLoading && total > pageSize && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            label="Standings pagination"
          />
        )}
      </section>

      <section aria-labelledby="results" className="flex flex-col gap-4">
        <h2 id="results" className="text-small font-bold uppercase tracking-wide text-neutral-900">
          Results
        </h2>
        <ResultsByCompetition lines={lines} loading={history.isLoading} label="Results" empty={{ title: 'No results yet' }} />
      </section>
    </div>
  )
}
