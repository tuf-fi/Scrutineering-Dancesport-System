import type { Result } from '@bis/shared'
import { Link } from 'react-router'
import { EmptyState, ErrorState, Skeleton, Table, type Column } from '../../components/ui/index.ts'
import { useCompetitors, useResults, useTeams } from '../../hooks/index.ts'
import { cn } from '../../lib/cn.ts'
import { competitorName, ordinal, placeRange } from '../../lib/format.ts'

// The placings of an event whose marks were never entered (a past competition added by its results), so there is
// no full sheet to show
export function PlacingsOnly({ eventId }: { eventId: string }) {
  const results = useResults(eventId)
  const competitors = useCompetitors()
  const teams = useTeams()
  if (results.isError || competitors.isError || teams.isError) return <ErrorState onRetry={() => void Promise.all([results.refetch(), competitors.refetch(), teams.refetch()])} />
  if (!results.data || !competitors.data || !teams.data) return <Skeleton className="h-40 w-full" />

  const people = new Map(competitors.data.map((c) => [c.id, c]))
  const teamName = new Map(teams.data.map((t) => [t.id, t.name]))
  const rows = results.data.filter((r) => people.has(r.competitorId))
  if (rows.length === 0) return <EmptyState title="No results yet" description="The results appear here once the scrutineer publishes the final." />

  const columns: Column<Result>[] = [
    {
      key: 'place',
      header: 'Place',
      cell: (r) => <span className={cn('font-semibold', r.place <= 3 ? 'text-gold-700' : 'text-neutral-500')}>{placeRange(r) ?? ordinal(r.place)}</span>,
      mono: true,
      widthClass: 'w-32',
    },
    {
      key: 'who',
      header: 'Participant',
      cell: (r) => {
        const c = people.get(r.competitorId)!
        return (
          <span className="flex flex-col">
            <Link to={`/competitors/${c.id}`} className="font-semibold text-neutral-900 transition-colors hover:text-gold-700 focus-visible:outline-2 focus-visible:outline-gold-500">
              {competitorName(c.names)}
            </Link>
            <span className="text-small text-neutral-600">{teamName.get(c.teamId)}</span>
          </span>
        )
      },
    },
    { key: 'no', header: 'No.', cell: (r) => people.get(r.competitorId)?.backNumber ?? '–', mono: true, align: 'center', widthClass: 'w-24' },
  ]

  return (
    <section aria-labelledby="placings" className="flex flex-col gap-4">
      <h2 id="placings" className="text-small font-bold uppercase tracking-wide text-neutral-900">
        Placings
      </h2>
      <p className="text-small text-neutral-600">The marks of each adjudicator were not entered for this event, so only the placings are shown.</p>
      <Table<Result> variant="plain" rows={rows} rowKey={(r) => r.id} minWidthClass="min-w-0" paginationLabel="Placings pagination" columns={columns} />
    </section>
  )
}
