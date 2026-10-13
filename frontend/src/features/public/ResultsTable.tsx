import type { Result } from '@bis/shared'
import { Link } from 'react-router'
import { Avatars } from '../../components/Avatars.tsx'
import { ErrorState, Table } from '../../components/ui/index.ts'
import { useCompetitorRows, useResults } from '../../hooks/index.ts'
import { competitorName, placeLabel } from '../../lib/format.ts'

// An event's placings, best first; each name opens that competitor's profile
export function ResultsTable({ eventId }: { eventId: string }) {
  const results = useResults(eventId)
  const people = useCompetitorRows()

  if (results.isError) return <ErrorState onRetry={() => void results.refetch()} />

  const byId = new Map((people.data ?? []).map((c) => [c.id, c]))
  const rows = [...(results.data ?? [])].sort((a, b) => a.place - b.place || (byId.get(a.competitorId)?.backNumber ?? 0) - (byId.get(b.competitorId)?.backNumber ?? 0))

  return (
    <Table<Result>
      loading={results.isLoading || people.isLoading}
      rows={rows}
      rowKey={(r) => r.id}
      minWidthClass="min-w-0"
      paginationLabel="Results pagination"
      detailTitle={(r) => competitorName(byId.get(r.competitorId)?.names ?? [])}
      empty={{ title: 'No results yet', description: 'Results appear here once the scrutineer publishes them.' }}
      columns={[
        { key: 'place', header: 'Place', cell: (r) => placeLabel(r.place), widthClass: 'w-32' },
        { key: 'back', header: 'No.', cell: (r) => byId.get(r.competitorId)?.backNumber ?? '–', mono: true, hideBelow: 'sm' },
        {
          key: 'who',
          header: 'Competitor',
          cell: (r) => {
            const c = byId.get(r.competitorId)
            return (
              <div className="flex items-center gap-3">
                <Avatars names={c?.names ?? []} />
                <Link to={`/competitors/${r.competitorId}`} className="font-medium text-neutral-900 hover:underline">
                  {competitorName(c?.names ?? [])}
                </Link>
              </div>
            )
          },
        },
        { key: 'club', header: 'Club', cell: (r) => byId.get(r.competitorId)?.clubName ?? '', muted: true, hideBelow: 'md' },
      ]}
    />
  )
}
