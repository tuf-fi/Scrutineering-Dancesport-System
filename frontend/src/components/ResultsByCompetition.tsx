import type { CompetitorHistoryLine } from '@bis/shared'
import { ArrowUpRight, ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { Link } from 'react-router'
import { usePagination } from '../hooks/usePagination.ts'
import { cn } from '../lib/cn.ts'
import { DANCE_LABEL, eventCode, eventGrade, formatDate, placeLabel, placeRange } from '../lib/format.ts'
import { EmptyState, Pagination, Skeleton } from './ui/index.ts'

interface Group {
  id: string
  name: string
  date: string
  lines: CompetitorHistoryLine[]
  points: number
}

// The results grouped by competition, newest competition first
function groupByCompetition(lines: CompetitorHistoryLine[]): Group[] {
  const groups = new Map<string, Group>()
  for (const l of lines) {
    const group = groups.get(l.competitionId) ?? { id: l.competitionId, name: l.competitionName, date: l.competitionDate, lines: [], points: 0 }
    group.lines.push(l)
    group.points += l.points
    groups.set(l.competitionId, group)
  }
  return [...groups.values()]
    .map((g) => ({ ...g, lines: g.lines.sort((a, b) => a.eventNumber - b.eventNumber) }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

// One competition as a card: its name opens the events the person placed in
function CompetitionGroup({ group, compact }: { group: Group; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const panel = useId()

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
            <span className="text-gold-700">{formatDate(group.date)}</span> <span aria-hidden>/</span> {group.lines.length} {group.lines.length === 1 ? 'result' : 'results'}
          </span>
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className={cn('font-semibold leading-none tracking-[-0.02em] tabular-nums text-neutral-900', compact ? 'text-small' : 'text-[1.125rem]')}>{group.points}</span>
          <span className="font-mono text-xs uppercase text-neutral-500">pts</span>
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
          <ol id={panel} aria-label={`Results at ${group.name}`} className="border-t border-neutral-200">
            {group.lines.map((l) => {
              const place = placeRange(l) ?? placeLabel(l.place)
              return (
                <li key={l.resultId} className={cn('group/row relative grid grid-cols-[3.5rem_minmax(0,1fr)_auto_1rem] items-center gap-x-4 border-t border-neutral-100 transition-colors first:border-t-0 hover:bg-neutral-50', compact ? 'px-4 py-2.5 sm:grid-cols-[4rem_minmax(0,1fr)_auto_1rem] sm:gap-x-4' : 'px-5 py-3.5 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto_1rem] sm:gap-x-6')}>
                  <span className={cn('font-semibold leading-none tracking-[-0.02em] tabular-nums', compact ? 'text-small' : 'text-body', l.place <= 3 ? 'text-gold-700' : 'text-neutral-500')}>{place}</span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <Link
                      to={`/competitions/${l.competitionId}/events/${l.eventId}?highlight=${l.competitorId}`}
                      tabIndex={open ? 0 : -1}
                      className={cn('font-medium text-neutral-900 after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-gold-500', compact && 'text-small')}
                    >
                      {l.dances.map((d) => DANCE_LABEL[d]).join(', ')}
                    </Link>
                    <span className={cn('text-neutral-500', compact ? 'text-xs' : 'text-small')}>
                      <span className="mr-2 font-mono tabular-nums">{eventCode({ number: l.eventNumber })}</span>
                      {eventGrade(l)}
                    </span>
                  </span>
                  <span className="flex items-baseline gap-1.5">
                    <span className={cn('font-semibold leading-none tracking-[-0.02em] tabular-nums text-neutral-900', compact ? 'text-small' : 'text-body')}>{l.points}</span>
                    <span className="font-mono text-xs uppercase text-neutral-400">pts</span>
                  </span>
                  <ArrowUpRight aria-hidden className="size-4 text-neutral-300 transition duration-300 group-hover/row:rotate-45 group-hover/row:text-gold-500" strokeWidth={1.5} />
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </li>
  )
}

interface ResultsByCompetitionProps {
  lines: CompetitorHistoryLine[]
  loading: boolean
  // The accessible name of the list, like "My results"
  label: string
  empty: { title: string; description?: string }
  // Smaller text and tighter rows, for a side panel
  compact?: boolean
}

// A person's placings as competition cards that open to show their events; paginated by competition
export function ResultsByCompetition({ lines, loading, label, empty, compact }: ResultsByCompetitionProps) {
  const groups = groupByCompetition(lines)
  const { page, setPage, pageSize, total, pageItems } = usePagination(groups, label)
  const points = lines.reduce((sum, l) => sum + l.points, 0)

  return (
    <>
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : groups.length === 0 ? (
        <EmptyState title={empty.title} description={empty.description} />
      ) : (
        <>
          <p className="font-mono text-xs uppercase text-neutral-500">
            {groups.length} {groups.length === 1 ? 'competition' : 'competitions'} <span aria-hidden>/</span> {lines.length} {lines.length === 1 ? 'result' : 'results'} <span aria-hidden>/</span> {points} pts in total
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
