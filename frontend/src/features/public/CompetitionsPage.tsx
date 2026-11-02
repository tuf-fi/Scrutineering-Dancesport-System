import type { Competition } from '@bis/shared'
import { ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, ErrorState, Pagination, SearchField, Select, Skeleton } from '../../components/ui/index.ts'
import { useCompetitions } from '../../hooks/index.ts'
import { usePagination } from '../../hooks/usePagination.ts'
import { cn } from '../../lib/cn.ts'
import { dateParts, formatDate, todayIso } from '../../lib/format.ts'
import { HeaderStat, HeaderStats, PublicHeader } from './PublicHeader.tsx'

type When = 'all' | 'upcoming' | 'past'

const daysUntil = (iso: string) => Math.round((Date.parse(iso) - Date.parse(todayIso())) / 86_400_000)

// Where a competition stands today, for the status beside its row
function status(c: Competition) {
  const days = daysUntil(c.date)
  if (days === 0) return { label: 'Today', tone: 'live' as const }
  if (days === 1) return { label: 'Tomorrow', tone: 'soon' as const }
  if (days > 1) return { label: `In ${days} days`, tone: 'soon' as const }
  return { label: 'Completed', tone: 'done' as const }
}

const DOT = { live: 'bg-gold-400', soon: 'bg-neutral-900', done: 'bg-neutral-300' }

// The next date a club still has to act on, if any
function nextDeadline(c: Competition) {
  const today = todayIso()
  const open = [
    c.entryDeadline && c.entryDeadline >= today ? { label: 'Entries close', date: c.entryDeadline } : null,
    c.feeDeadline && c.feeDeadline >= today ? { label: 'Fees due', date: c.feeDeadline } : null,
  ].filter((d): d is { label: string; date: string } => d !== null)
  return open.sort((a, b) => a.date.localeCompare(b.date))[0]
}

function Deadline({ c, className }: { c: Competition; className?: string }) {
  const deadline = nextDeadline(c)
  if (!deadline) return null
  return (
    <p className={cn('font-mono text-xs font-medium uppercase tabular-nums', className)}>
      {deadline.label} {formatDate(deadline.date)}
    </p>
  )
}

function CompetitionRow({ c }: { c: Competition }) {
  const d = dateParts(c.date)
  const s = status(c)
  const done = s.tone === 'done'

  return (
    <li className="group relative grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t border-neutral-200 py-5 transition-colors hover:bg-gold-50 sm:px-3 lg:grid-cols-[8rem_minmax(0,1.6fr)_minmax(0,1fr)_9rem_1.5rem] lg:items-baseline lg:gap-x-8 lg:py-6">
      <span className={cn('col-span-2 font-mono text-xs font-medium uppercase tabular-nums lg:col-span-1', done ? 'text-neutral-500' : 'text-gold-700')}>
        {d.day} {d.month} {d.year}
      </span>

      <div className="flex min-w-0 flex-col gap-1">
        <h2 className={cn('text-balance text-[1.125rem] font-semibold leading-[1.2] tracking-[-0.02em] lg:text-[1.375rem]', done ? 'text-neutral-600' : 'text-neutral-900')}>
          <Link to={`/competitions/${c.id}`} className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-gold-500">
            {c.name}
          </Link>
        </h2>
        {!done && <Deadline c={c} className="text-gold-700" />}
      </div>

      <p className="col-start-1 text-small text-neutral-600 lg:col-start-auto">
        {c.venue} <span aria-hidden>/</span> <span className="sr-only">organized by</span> {c.organizer}
      </p>

      <span className="col-start-2 row-start-2 flex items-center gap-2 self-start whitespace-nowrap text-small font-medium text-neutral-700 lg:col-start-auto lg:row-start-auto">
        <span aria-hidden className={cn('size-1.5 rounded-full', DOT[s.tone])} />
        {s.label}
      </span>

      <ArrowUpRight
        aria-hidden
        className="hidden size-5 self-center text-neutral-400 transition duration-300 group-hover:rotate-45 group-hover:text-gold-500 lg:block"
        strokeWidth={1.5}
      />
    </li>
  )
}

function ListHead() {
  return (
    <div aria-hidden className="hidden grid-cols-[8rem_minmax(0,1.6fr)_minmax(0,1fr)_9rem_1.5rem] gap-x-8 px-3 pb-3 font-mono text-xs uppercase text-neutral-500 lg:grid">
      <span>Date</span>
      <span>Competition</span>
      <span>Venue / Organizer</span>
      <span>Status</span>
      <span />
    </div>
  )
}

function ListSkeleton() {
  return (
    <div aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 border-t border-neutral-200 py-6 sm:px-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-3/4 max-w-md" />
          <Skeleton className="h-4 w-1/2 max-w-xs" />
        </div>
      ))}
    </div>
  )
}

export function CompetitionsPage() {
  const competitions = useCompetitions()
  const [when, setWhen] = useState<When>('all')
  const [query, setQuery] = useState('')

  const all = competitions.data ?? []
  const today = todayIso()
  const upcomingCount = all.filter((c) => c.date >= today).length
  const needle = query.trim().toLowerCase()
  const matches = all
    .filter((c) => (when === 'upcoming' ? c.date >= today : when === 'past' ? c.date < today : true))
    .filter((c) => !needle || `${c.name} ${c.venue} ${c.organizer}`.toLowerCase().includes(needle))
    // Coming up soonest first, then the past newest first
    .sort((a, b) => {
      const aPast = a.date < today
      const bPast = b.date < today
      if (aPast !== bPast) return aPast ? 1 : -1
      return aPast ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
    })
  const { page, setPage, pageSize, total, pageItems } = usePagination(matches, `${when}|${needle}`)

  if (competitions.isError) return <ErrorState onRetry={() => void competitions.refetch()} />

  return (
    <div className="flex flex-col gap-8">
      <PublicHeader
        title="Competitions"
        eyebrow="Season calendar"
        description="Every dancesport competition run on BIS. Open one for its events, program and results."
        aside={
          <HeaderStats>
            <HeaderStat value={competitions.isLoading ? '–' : all.length} label="Total" />
            <HeaderStat value={competitions.isLoading ? '–' : upcomingCount} label="Upcoming" />
          </HeaderStats>
        }
      />

      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] sm:gap-x-4">
        <SearchField className="col-span-2 sm:col-span-1" value={query} onChange={setQuery} />
        <Select label="Show" value={when} onChange={(e) => setWhen(e.target.value as When)} className="col-span-2 sm:col-span-1">
          <option value="all">All ({all.length})</option>
          <option value="upcoming">Upcoming ({upcomingCount})</option>
          <option value="past">Completed ({all.length - upcomingCount})</option>
        </Select>
      </div>

      <section aria-labelledby="list" className="flex flex-col gap-4">
        <h2 id="list" className="text-small font-bold uppercase tracking-wide text-neutral-900">
          {when === 'all' ? 'All competitions' : when === 'upcoming' ? 'Upcoming' : 'Completed'}
        </h2>

        {competitions.isLoading ? (
          <ListSkeleton />
        ) : matches.length === 0 ? (
          <EmptyState
            title={all.length === 0 ? 'No competitions yet' : 'No competitions match'}
            description={all.length === 0 ? 'Competitions appear here as soon as they are announced.' : 'Try a different name or show all competitions.'}
          />
        ) : (
          <div>
            <ListHead />
            <ul className="border-b border-neutral-200">
              {pageItems.map((c) => (
                <CompetitionRow key={c.id} c={c} />
              ))}
            </ul>
          </div>
        )}

        {!competitions.isLoading && total > pageSize && (
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="Competitions pagination" />
        )}
      </section>
    </div>
  )
}
