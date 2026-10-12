import type { CompetitorHistoryLine } from '@bis/shared'
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Avatars } from '../../components/Avatars.tsx'
import { Fact } from '../../components/Fact.tsx'
import { ButtonLink, EmptyState, ErrorState, Skeleton, Table } from '../../components/ui/index.ts'
import {
  useClubs,
  useCompetitorHistory,
  useCompetitors,
  useRankingPoints,
} from '../../hooks/index.ts'
import {
  DANCE_LABEL,
  competitorName,
  eventCode,
  eventGrade,
  formatDate,
  placeLabel,
} from '../../lib/format.ts'
import { categoriesOf, rankCategory, type CategoryFilter } from '../../lib/rankings.ts'

interface CategoryStanding extends CategoryFilter {
  rank: number
  of: number
  points: number
}

export function CompetitorPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const competitors = useCompetitors()
  const clubs = useClubs()
  const history = useCompetitorHistory(id)
  const points = useRankingPoints()

  const competitor = competitors.data?.find((c) => c.id === id)
  const club = clubs.data?.find((c) => c.id === competitor?.clubId)

  const standings = useMemo<CategoryStanding[]>(() => {
    const all = points.data ?? []
    return categoriesOf(all, id)
      .flatMap((category) => {
        const rows = rankCategory(all, category)
        const mine = rows.find((r) => r.competitorId === id)
        return mine ? [{ ...category, rank: mine.rank, of: rows.length, points: mine.points }] : []
      })
      .sort((a, b) => b.points - a.points)
  }, [points.data, id])

  if (competitors.isError || history.isError || points.isError) {
    return (
      <ErrorState
        onRetry={() => void Promise.all([competitors.refetch(), history.refetch(), points.refetch()])}
      />
    )
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
        action={<ButtonLink to="/rankings" variant="secondary">Back to rankings</ButtonLink>}
      />
    )
  }

  const lines = history.data ?? []
  const competitionCount = new Set(lines.map((l) => l.competitionId)).size

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-6">
        <ButtonLink to="/rankings" variant="ghost" size="sm" className="-ml-3 w-fit">
          Rankings
        </ButtonLink>
        <div className="flex items-center gap-5">
          <Avatars names={competitor.names} size="xl" />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-balance text-display font-semibold text-neutral-900">
              {competitorName(competitor.names)}
            </h1>
            <p className="text-body text-neutral-600">{club?.name}</p>
          </div>
        </div>
      </div>

      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
        <Fact label="Competitions">{competitionCount}</Fact>
        <Fact label="Results">{lines.length}</Fact>
        <Fact label="Categories">{standings.length}</Fact>
      </dl>

      <section className="flex flex-col gap-4">
        <h2 className="text-title font-semibold">Rankings</h2>
        <Table<CategoryStanding>
          loading={points.isLoading}
          rows={standings}
          rowKey={(s) => `${s.ageGroup}|${s.class}|${s.discipline}`}
          minWidthClass="min-w-0"
          paginationLabel="Standings pagination"
          onRowClick={(s) =>
            navigate(`/rankings?discipline=${s.discipline}&age=${s.ageGroup}&class=${s.class}`)
          }
          empty={{ title: 'Not ranked yet', description: 'Points appear after a result in a ranked category.' }}
          columns={[
            { key: 'category', header: 'Category', cell: (s) => <span className="font-medium">{eventGrade(s)}</span> },
            {
              key: 'rank',
              header: 'Rank',
              align: 'right',
              mono: true,
              cell: (s) => (
                <>
                  <span className="font-semibold">{s.rank}</span>
                  <span className="text-neutral-500"> of {s.of}</span>
                </>
              ),
            },
            {
              key: 'points',
              header: 'Points',
              align: 'right',
              mono: true,
              cell: (s) => <span className="font-semibold">{s.points}</span>,
            },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-title font-semibold">Results</h2>
        <Table<CompetitorHistoryLine>
          loading={history.isLoading}
          rows={lines}
          rowKey={(l) => l.resultId}
          minWidthClass="min-w-0"
          paginationLabel="Results pagination"
          empty={{ title: 'No results yet' }}
          columns={[
            {
              key: 'competition',
              header: 'Competition',
              cell: (l) => (
                <div className="flex flex-col">
                  <span className="font-medium">{l.competitionName}</span>
                  <span className="text-neutral-600">{formatDate(l.competitionDate)}</span>
                  {/* On phones the event column is hidden, so its details move here */}
                  <span className="text-neutral-600 sm:hidden">
                    {eventCode({ number: l.eventNumber })} {l.dances.map((d) => DANCE_LABEL[d]).join(', ')}
                  </span>
                </div>
              ),
            },
            {
              key: 'event',
              header: 'Event',
              hideBelow: 'sm',
              cell: (l) => (
                <div className="flex flex-col">
                  <span>
                    <span className="font-mono tabular-nums">{eventCode({ number: l.eventNumber })}</span>{' '}
                    {l.dances.map((d) => DANCE_LABEL[d]).join(', ')}
                  </span>
                  <span className="text-neutral-600">{eventGrade(l)}</span>
                </div>
              ),
            },
            { key: 'place', header: 'Result', cell: (l) => placeLabel(l.place) },
            {
              key: 'points',
              header: 'Points',
              align: 'right',
              mono: true,
              cell: (l) => <span className="font-semibold">{l.points}</span>,
            },
          ]}
        />
      </section>
    </div>
  )
}
