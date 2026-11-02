import type { MyEntry } from '@bis/shared'
import { ArrowUpRight, ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, Pagination, Skeleton } from './ui/index.ts'
import { usePagination } from '../hooks/usePagination.ts'
import { cn } from '../lib/cn.ts'
import { DANCE_LABEL, eventCode, eventGrade, formatDate, todayIso } from '../lib/format.ts'

interface Group {
  id: string
  name: string
  date: string
  upcoming: boolean
  entries: MyEntry[]
}

// The entries grouped by competition: what is coming up first, soonest first, then what is done, newest first
function groupByCompetition(entries: MyEntry[], today: string): Group[] {
  const groups = new Map<string, Group>()
  for (const e of entries) {
    const group = groups.get(e.competitionId) ?? { id: e.competitionId, name: e.competitionName, date: e.competitionDate, upcoming: e.competitionDate >= today, entries: [] }
    group.entries.push(e)
    groups.set(e.competitionId, group)
  }
  return [...groups.values()]
    .map((g) => ({ ...g, entries: g.entries.sort((a, b) => a.eventNumber - b.eventNumber) }))
    .sort((a, b) => Number(b.upcoming) - Number(a.upcoming) || (a.upcoming ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)))
}

// One competition as a card: its name opens the events the athlete is entered in
function CompetitionGroup({ group, compact }: { group: Group; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const panel = useId()
  const active = group.entries.filter((e) => !e.scratched).length

  return (
    <li className={cn('overflow-hidden rounded-xl border transition-colors duration-300', open ? 'border-neutral-300' : 'border-neutral-200 hover:border-neutral-300')}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((o) => !o)}
        className={cn('flex w-full items-center gap-x-4 text-left transition-colors duration-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold-500', compact ? 'px-4 py-3' : 'px-5 py-4', open && 'bg-gold-50')}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={cn('font-semibold tracking-[-0.01em] text-neutral-900', compact ? 'text-small' : 'text-body')}>{group.name}</span>
          <span className="font-mono text-xs uppercase tabular-nums text-neutral-500">
            <span className="text-gold-700">{formatDate(group.date)}</span> <span aria-hidden>/</span> {group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}
          </span>
        </span>
        <span className="flex items-center gap-2 whitespace-nowrap text-small font-medium text-neutral-700">
          <span aria-hidden className={cn('size-1.5 rounded-full', active === 0 ? 'bg-neutral-300' : group.upcoming ? 'bg-gold-400' : 'bg-neutral-900')} />
          {active === 0 ? 'Scratched' : group.upcoming ? 'Upcoming' : 'Done'}
        </span>
        <span aria-hidden className={cn('grid size-7 shrink-0 place-items-center rounded-full border transition-colors duration-300', open ? 'border-gold-400 bg-gold-400 text-black' : 'border-neutral-300 text-neutral-500')}>
          <ChevronDown className={cn('size-4 transition-transform duration-300', open && 'rotate-180')} strokeWidth={1.75} />
        </span>
      </button>

      {/* The panel stays mounted and grows from zero height, so it opens and closes smoothly */}
      <div
        className={cn('grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="overflow-hidden">
          <ol id={panel} aria-label={`Entries at ${group.name}`} className="border-t border-neutral-200">
            {group.entries.map((e) => (
              <li
                key={e.entryId}
                className={cn('group/row relative grid grid-cols-[3.5rem_minmax(0,1fr)_auto_1rem] items-center gap-x-4 border-t border-neutral-100 transition-colors first:border-t-0 hover:bg-neutral-50', compact ? 'px-4 py-2.5 sm:grid-cols-[4rem_minmax(0,1fr)_auto_1rem]' : 'px-5 py-3.5 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto_1rem] sm:gap-x-6')}
              >
                <span className={cn('font-mono font-semibold leading-none tabular-nums', compact ? 'text-small' : 'text-body', e.scratched ? 'text-neutral-400 line-through' : 'text-neutral-500')}>{eventCode({ number: e.eventNumber })}</span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <Link
                    to={`/competitions/${e.competitionId}?event=${e.eventId}`}
                    tabIndex={open ? 0 : -1}
                    className={cn('font-medium after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-gold-500', compact && 'text-small', e.scratched ? 'text-neutral-500' : 'text-neutral-900')}
                  >
                    {e.dances.map((d) => DANCE_LABEL[d]).join(', ')}
                  </Link>
                  <span className={cn('text-neutral-500', compact ? 'text-xs' : 'text-small')}>
                    {eventGrade(e)}
                    {e.names.length > 1 && (
                      <>
                        {' '}
                        <span aria-hidden>/</span> {e.names.join(' & ')}
                      </>
                    )}
                  </span>
                </span>
                <span className="flex items-center gap-2 whitespace-nowrap text-small font-medium text-neutral-700">
                  <span aria-hidden className={cn('size-1.5 rounded-full', e.scratched ? 'bg-neutral-300' : group.upcoming ? 'bg-gold-400' : 'bg-neutral-900')} />
                  {e.scratched ? 'Scratched' : group.upcoming ? 'Upcoming' : 'Done'}
                </span>
                <ArrowUpRight aria-hidden className="size-4 text-neutral-300 transition duration-300 group-hover/row:rotate-45 group-hover/row:text-gold-500" strokeWidth={1.5} />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </li>
  )
}

interface EntriesByCompetitionProps {
  entries: MyEntry[]
  loading: boolean
  // The accessible name of the list, like "My entries"
  label: string
  empty: { title: string; description?: string }
  // Smaller text and tighter rows, for a side panel
  compact?: boolean
}

// A person's entries as competition cards that open to show their events; paginated by competition
export function EntriesByCompetition({ entries, loading, label, empty, compact }: EntriesByCompetitionProps) {
  const today = todayIso()
  const groups = groupByCompetition(entries, today)
  const { page, setPage, pageSize, total, pageItems } = usePagination(groups, label)
  const upcoming = entries.filter((e) => !e.scratched && e.competitionDate >= today).length

  return (
    <>
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : groups.length === 0 ? (
        <EmptyState title={empty.title} description={empty.description} />
      ) : (
        <>
          <p className="font-mono text-xs uppercase text-neutral-500">
            {groups.length} {groups.length === 1 ? 'competition' : 'competitions'} <span aria-hidden>/</span> {entries.length} {entries.length === 1 ? 'entry' : 'entries'} <span aria-hidden>/</span> {upcoming} coming up
          </p>
          <ol aria-label={label} className="flex flex-col gap-3">
            {pageItems.map((group) => (
              <CompetitionGroup key={group.id} group={group} compact={compact} />
            ))}
          </ol>
        </>
      )}
      {!loading && total > pageSize && <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label={`${label} pagination`} />}
    </>
  )
}
