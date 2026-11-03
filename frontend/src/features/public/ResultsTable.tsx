import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import { Avatars } from '../../components/Avatars.tsx'
import { EmptyState, ErrorState, Pagination, Skeleton } from '../../components/ui/index.ts'
import { useTeams, useCompetitors, useResults } from '../../hooks/index.ts'
import { usePagination } from '../../hooks/usePagination.ts'
import { useRevealRow } from '../../hooks/useRevealRow.ts'
import { cn } from '../../lib/cn.ts'
import { competitorName, placeLabel, placeRange } from '../../lib/format.ts'

// An event's placings, best first; each name opens that competitor's profile
export function ResultsTable({ eventId }: { eventId: string }) {
  const results = useResults(eventId)
  const people = useCompetitors()
  const teams = useTeams()

  const byId = new Map((people.data ?? []).map((c) => [c.id, c]))
  const teamName = new Map((teams.data ?? []).map((c) => [c.id, c.name]))
  const rows = [...(results.data ?? [])].sort((a, b) => a.place - b.place || (byId.get(a.competitorId)?.backNumber ?? 0) - (byId.get(b.competitorId)?.backNumber ?? 0))
  const { page, setPage, pageSize, total, pageItems } = usePagination(rows, eventId)

  const revealed = useRevealRow(rows, (r) => r.competitorId, pageSize, setPage, !results.isLoading && !people.isLoading && !teams.isLoading)

  if (results.isError) return <ErrorState onRetry={() => void results.refetch()} />

  const loading = results.isLoading || people.isLoading || teams.isLoading

  return (
    <section aria-labelledby="placings" className="flex flex-col gap-4">
      <h2 id="placings" className="text-small font-bold uppercase tracking-wide text-neutral-900">
        Results
      </h2>

      {loading ? (
        <div aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="grid grid-cols-[5rem_1fr] items-center gap-x-4 border-t border-neutral-200 py-4 sm:px-3">
              <Skeleton className="h-5 w-12" />
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="No results yet" description="Results appear here once the scrutineer publishes them." />
      ) : (
        <ol aria-label="Results" className="border-b border-neutral-200">
          {pageItems.map((r) => {
            const c = byId.get(r.competitorId)
            const tied = placeRange(r)
            return (
              <li
                key={r.id}
                data-row={r.competitorId}
                className={cn('group relative grid grid-cols-[5rem_1fr_auto] items-center gap-x-4 border-t border-neutral-200 py-4 transition-colors hover:bg-gold-50 sm:grid-cols-[8rem_1fr_auto] sm:gap-x-8 sm:px-3 sm:py-5', revealed === r.competitorId && 'bg-gold-50')}
              >
                <span className={cn('font-mono text-small font-medium tabular-nums', r.place <= 3 ? 'text-gold-700' : 'text-neutral-500')}>
                  {tied ?? placeLabel(r.place)}
                </span>

                <div className="flex min-w-0 items-center gap-3">
                  <Avatars names={c?.names ?? []} />
                  <div className="flex min-w-0 flex-col">
                    <Link
                      to={`/competitors/${r.competitorId}`}
                      className="truncate font-semibold text-neutral-900 after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-gold-500"
                    >
                      {competitorName(c?.names ?? [])}
                    </Link>
                    <span className="truncate text-small text-neutral-600">{c ? teamName.get(c.teamId) : ''}</span>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <span className="hidden font-mono text-small tabular-nums text-neutral-600 sm:inline">No. {c?.backNumber ?? '–'}</span>
                  <ArrowUpRight
                    aria-hidden
                    className="hidden size-5 text-neutral-400 transition duration-300 group-hover:rotate-45 group-hover:text-gold-500 sm:block"
                    strokeWidth={1.5}
                  />
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {!loading && total > pageSize && <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="Results pagination" />}
    </section>
  )
}
