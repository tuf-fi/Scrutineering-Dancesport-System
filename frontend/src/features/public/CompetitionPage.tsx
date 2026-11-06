import { ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ButtonLink, EmptyState, ErrorState, Pagination, SearchField, Select, Skeleton } from '../../components/ui/index.ts'
import { useCompetition, useEvents, useResultEventIds, useCatalog } from '../../hooks/index.ts'
import { usePagination } from '../../hooks/usePagination.ts'
import { useRevealRow } from '../../hooks/useRevealRow.ts'
import { cn } from '../../lib/cn.ts'
import { HeaderStat, HeaderStats, PublicHeader } from './PublicHeader.tsx'
import { DISCIPLINE_LABEL, eventCode, eventDances, formatDate } from '../../lib/format.ts'

const COLS = 'lg:grid-cols-[5rem_minmax(0,1.6fr)_minmax(0,1fr)_7rem_1.5rem]'

// One competition's events; the ones with results link to them
export function CompetitionPage({ resultsOnly = false }: { resultsOnly?: boolean } = {}) {
  const { ageGroups, ageGroupLabel } = useCatalog()
  const { competitionId = '' } = useParams()
  const competition = useCompetition(competitionId)
  const events = useEvents(competitionId)
  const withResults = useResultEventIds(competitionId)
  const [query, setQuery] = useState('')
  const [ageGroup, setAgeGroup] = useState('all')

  const needle = query.trim().toLowerCase()
  const rows = [...(events.data ?? [])]
    .sort((a, b) => a.number - b.number)
    .filter((e) => !resultsOnly || withResults.data?.includes(e.id))
    .filter(
      (e) =>
        (ageGroup === 'all' || e.ageGroup === ageGroup) &&
        (!needle || `${eventCode(e)} ${eventDances(e)} ${DISCIPLINE_LABEL[e.discipline]} ${e.class}`.toLowerCase().includes(needle)),
    )
  const { page, setPage, pageSize, total, pageItems } = usePagination(rows, `${ageGroup}|${needle}`)

  const revealed = useRevealRow(rows, (e) => e.id, pageSize, setPage, !events.isLoading, 'event')

  if (competition.isError || events.isError) {
    return <ErrorState onRetry={() => void Promise.all([competition.refetch(), events.refetch()])} />
  }
  if (!competition.data) return <Skeleton className="h-24 w-full max-w-xl" />

  const c = competition.data
  const allEvents = events.data ?? []
  const publishedCount = allEvents.filter((e) => withResults.data?.includes(e.id)).length
  const loading = events.isLoading || withResults.isLoading

  return (
    <div className="flex flex-col gap-8">
      <PublicHeader
        back={resultsOnly ? { to: '/results', label: 'All results' } : { to: '/competitions', label: 'All competitions' }}
        eyebrow={formatDate(c.date)}
        title={c.name}
        description={
          <>
            <span className="block">{c.venue}</span>
            <span className="block">Organized by {c.organizer}</span>
          </>
        }
        meta={
          resultsOnly ? undefined : (
            <ButtonLink to={`/competitions/${competitionId}/program`}>
              Program and running order
            </ButtonLink>
          )
        }
        aside={
          !events.isLoading && (
            <HeaderStats>
              <HeaderStat value={allEvents.length} label="Events" />
              <HeaderStat value={publishedCount} label="With results" />
            </HeaderStats>
          )
        }
      />

      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] sm:gap-x-4">
        <SearchField className="col-span-2 sm:col-span-1" label="Search events" value={query} onChange={setQuery} />
        <Select label="Age group" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} className="col-span-2 sm:col-span-1">
          <option value="all">All age groups</option>
          {ageGroups.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>

      <section aria-labelledby="events" className="flex flex-col gap-4">
        <h2 id="events" className="text-small font-bold uppercase tracking-wide text-neutral-900">
          {resultsOnly ? 'Event results' : 'Events'}
        </h2>

        {loading ? (
          <div aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex flex-col gap-3 border-t border-neutral-200 py-5 sm:px-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-2/3 max-w-sm" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title={resultsOnly && allEvents.length > 0 && !needle && ageGroup === 'all' ? 'No results published yet' : 'No events match'} description={resultsOnly && !needle && ageGroup === 'all' ? 'Results appear here as each event is approved.' : 'Try a different age group or search.'} />
        ) : (
          <div>
            <div aria-hidden className={cn('hidden gap-x-8 px-3 pb-3 font-mono text-xs uppercase text-neutral-500 lg:grid', COLS)}>
              <span>Event</span>
              <span>Dances</span>
              <span>Age group / Class</span>
              <span>Results</span>
              <span />
            </div>
            <ul className="border-b border-neutral-200">
              {pageItems.map((e) => {
                const published = withResults.data?.includes(e.id)
                return (
                  <li
                    key={e.id}
                    data-row={e.id}
                    className={cn(
                      'group relative grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t border-neutral-200 py-4 transition-colors sm:px-3 lg:items-baseline lg:gap-x-8 lg:py-5',
                      COLS,
                      published && 'hover:bg-gold-50',
                      revealed === e.id && 'bg-gold-50',
                    )}
                  >
                    <span className="col-span-2 font-mono text-xs font-medium tabular-nums text-gold-700 lg:col-span-1">{eventCode(e)}</span>
                    <h3 className={cn('font-semibold tracking-[-0.01em] lg:text-[1.0625rem]', published ? 'text-neutral-900' : 'text-neutral-700')}>
                      {published ? (
                        <Link to={`/competitions/${competitionId}/events/${e.id}`} className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-gold-500">
                          <span className="sr-only">{eventCode(e)} </span>
                          {eventDances(e)}
                        </Link>
                      ) : (
                        eventDances(e)
                      )}
                    </h3>
                    <p className="col-start-1 text-small text-neutral-600 lg:col-start-auto">
                      {ageGroupLabel(e.ageGroup)} <span aria-hidden>/</span> {e.class} <span aria-hidden>/</span> {DISCIPLINE_LABEL[e.discipline]}
                    </p>
                    <span className="col-start-2 row-start-2 flex items-center gap-2 self-start whitespace-nowrap text-small font-medium text-neutral-700 lg:col-start-auto lg:row-start-auto">
                      <span aria-hidden className={cn('size-1.5 rounded-full', published ? 'bg-gold-400' : 'bg-neutral-300')} />
                      {published ? 'Published' : 'Not yet'}
                    </span>
                    {published && (
                      <ArrowUpRight
                        aria-hidden
                        className="hidden size-5 self-center text-neutral-400 transition duration-300 group-hover:rotate-45 group-hover:text-gold-500 lg:block"
                        strokeWidth={1.5}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {!loading && total > pageSize && <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="Events pagination" />}
      </section>
    </div>
  )
}
