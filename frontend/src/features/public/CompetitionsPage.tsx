import type { Competition } from '@bis/shared'
import { Link } from 'react-router'
import { ErrorState, PageHeader, Table } from '../../components/ui/index.ts'
import { useCompetitions } from '../../hooks/index.ts'
import { formatDate } from '../../lib/format.ts'

export function CompetitionsPage() {
  const competitions = useCompetitions()

  if (competitions.isError) return <ErrorState onRetry={() => void competitions.refetch()} />

  const rows = [...(competitions.data ?? [])].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Competitions" description="Every competition run on BIS, newest first." />
      <Table<Competition>
        loading={competitions.isLoading}
        rows={rows}
        rowKey={(c) => c.id}
        minWidthClass="min-w-0"
        paginationLabel="Competitions pagination"
        detailTitle={(c) => c.name}
        empty={{ title: 'No competitions yet' }}
        columns={[
          {
            key: 'name',
            header: 'Competition',
            cell: (c) => (
              <div className="flex min-w-0 flex-col">
                <Link to={`/competitions/${c.id}`} className="font-medium text-neutral-900 hover:underline">
                  {c.name}
                </Link>
                <span className="truncate text-small text-neutral-600">{c.venue}</span>
              </div>
            ),
          },
          { key: 'date', header: 'Date', cell: (c) => formatDate(c.date) },
          { key: 'organizer', header: 'Organizer', cell: (c) => c.organizer, muted: true, hideBelow: 'md' },
        ]}
      />
    </div>
  )
}
