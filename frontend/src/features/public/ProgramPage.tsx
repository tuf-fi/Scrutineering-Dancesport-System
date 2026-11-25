import { ProgramKind, ProgramStatus, RoundType } from '@bis/shared'
import { useState } from 'react'
import { useParams } from 'react-router'
import { ProgramStatusBadge } from '../../components/ProgramStatusBadge.tsx'
import { StatusDot, StatusLegend } from '../../components/StatusDot.tsx'
import { Button, EmptyState, ErrorState, Input, Pagination, SearchField, Select, Skeleton } from '../../components/ui/index.ts'
import { useCompetition, useDocumentTitle, useEntriesByBackNumber, useProgram, useCatalog } from '../../hooks/index.ts'
import { usePagination } from '../../hooks/usePagination.ts'
import { cn } from '../../lib/cn.ts'
import {
  ROUND_TYPE_LABEL,
  eventCode,
  eventDances,
  formatClock,
  formatDate,
  adjudicatorSets,
  programAction,
  todayIso,
} from '../../lib/format.ts'
import { HeatSplit } from '../../components/HeatSplit.tsx'
import { OnTheFloor } from './OnTheFloor.tsx'
import { PublicHeader } from './PublicHeader.tsx'
import { filterProgram } from '../../lib/programFilter.ts'

const COLS = 'lg:grid-cols-[4.5rem_6rem_minmax(0,1.6fr)_8rem_minmax(0,1fr)_8rem]'

// The running order of one competition, live: what is on the floor, what is next, and when everything else starts
export function ProgramPage() {
  const { eventGrade, ageGroupLabel } = useCatalog()
  const { competitionId = '' } = useParams()
  const competition = useCompetition(competitionId)
  const program = useProgram(competitionId)
  useDocumentTitle(competition.data ? `${competition.data.name} program` : 'Program')
  const [query, setQuery] = useState('')
  const [round, setRound] = useState('all')
  const [back, setBack] = useState('')
  // A back number is a whole number; anything else filters nothing
  const number = /^\d+$/.test(back.trim()) ? Number(back) : null
  const mine = useEntriesByBackNumber(competitionId, number)

  // A competition held on an earlier day is finished: every line reads Completed, whatever the round states say
  const past = competition.data ? competition.data.date < todayIso() : false
  const all = (program.data?.rows ?? []).map((r) => (past && r.kind === ProgramKind.Round ? { ...r, status: ProgramStatus.Completed } : r))
  const setName = adjudicatorSets(all)
  const rows = filterProgram(all, query, round, number === null ? null : new Set(mine.data ?? []), ageGroupLabel)
  const { page, setPage, pageSize, total, pageItems } = usePagination(rows, `${query}|${round}|${back}`)

  if (competition.isError || program.isError) {
    return <ErrorState onRetry={() => void Promise.all([competition.refetch(), program.refetch()])} />
  }
  if (!competition.data) return <Skeleton className="h-24 w-full max-w-xl" />

  const filtered = query.trim() !== '' || round !== 'all' || back.trim() !== ''
  const loading = program.isLoading || (number !== null && mine.isLoading)

  return (
    <div className="flex flex-col gap-8">
      <PublicHeader
        back={{ to: `/competitions/${competitionId}`, label: competition.data.name }}
        eyebrow={formatDate(competition.data.date)}
        title="Program"
        description={
          <>
            <span className="block">{competition.data.venue}</span>
            <span className="block">Organized by {competition.data.organizer}</span>
          </>
        }
      />

      {program.isLoading ? (
        <Skeleton className="h-28 w-full" />
      ) : (
        all.length > 0 &&
        !past && (
          <OnTheFloor rows={all} />
        )
      )}

      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_8rem] sm:gap-x-4">
        <SearchField className="col-span-2 sm:col-span-1" label="Search program" value={query} onChange={setQuery} />
        <Select label="Round" value={round} onChange={(e) => setRound(e.target.value)}>
          <option value="all">All rounds</option>
          {Object.values(RoundType).map((t) => (
            <option key={t} value={t}>
              {ROUND_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
        <Input label="Back number" inputMode="numeric" value={back} onChange={(e) => setBack(e.target.value)} className="font-mono tabular-nums" />
      </div>

      <section aria-labelledby="running-order" className="flex flex-col gap-4">
        <h2 id="running-order" className="text-small font-bold uppercase tracking-wide text-neutral-900">
          Running order
        </h2>
        {rows.length > 0 && <StatusLegend />}

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
          <EmptyState
            title={all.length === 0 ? 'No program yet' : 'No lines match'}
            description={all.length === 0 ? 'The running order appears here once the organizers publish it.' : 'Try a different round or search.'}
            action={
              all.length > 0 && filtered ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery('')
                    setRound('all')
                    setBack('')
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div>
            <div aria-hidden className={cn('hidden gap-x-8 px-3 pb-3 font-mono text-xs uppercase text-neutral-500 lg:grid', COLS)}>
              <span>No.</span>
              <span>Time</span>
              <span>Event</span>
              <span className="text-center">No. of Entries</span>
              <span>Round / Action</span>
              <span className="text-right">Status</span>
            </div>
            <ul aria-label="Running order" className="border-b border-neutral-200">
              {pageItems.map((r) => (
                <li
                  key={r.slotId}
                  className={cn(
                    'grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t border-neutral-200 py-4 sm:px-3 lg:items-baseline lg:gap-x-8 lg:py-5',
                    COLS,
                    r.status === ProgramStatus.Current && 'bg-gold-50',
                  )}
                >
                  <span className="col-span-2 flex items-center gap-2.5 font-mono text-xs tabular-nums text-neutral-500 lg:col-span-1 lg:text-small">
                    <StatusDot status={r.status} />
                    <span className="lg:hidden">No. </span>
                    {r.sequence}
                  </span>
                  <span className="col-span-2 font-mono text-xs font-medium tabular-nums text-gold-700 lg:col-span-1">{formatClock(r.startTime)}</span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {r.kind === ProgramKind.Round && r.eventNumber !== null && r.ageGroup && r.class && r.discipline ? (
                      <>
                        <h3 className="font-semibold tracking-[-0.01em] text-neutral-900 lg:text-[1.0625rem]">
                          <span className="mr-2 font-mono text-small font-medium tabular-nums text-neutral-500">{eventCode({ number: r.eventNumber })}</span>
                          {eventGrade({ ageGroup: r.ageGroup, class: r.class, discipline: r.discipline })}
                        </h3>
                        <p className="text-small text-neutral-600">{eventDances(r)}</p>
                      </>
                    ) : (
                      <h3 className="font-semibold tracking-[-0.01em] text-neutral-900 lg:text-[1.0625rem]">{r.label}</h3>
                    )}
                  </div>
                  <span className="hidden text-center font-mono text-small tabular-nums text-neutral-700 lg:block">{r.kind === ProgramKind.Round ? r.entryCount : ''}
                    <HeatSplit heats={r.heats} className="text-xs" />
                  </span>
                  <p className="col-start-1 text-small text-neutral-600 lg:col-start-auto">
                    {[r.roundType && ROUND_TYPE_LABEL[r.roundType], programAction(r)].filter(Boolean).join(' · ')}
                    {r.adjudicators.length > 0 && <span className="block font-mono text-xs">Adjudicators: {setName(r.adjudicators)}</span>}
                  </p>
                  <span className="col-start-2 row-start-2 self-start lg:col-start-auto lg:row-start-auto lg:justify-self-end">
                    <ProgramStatusBadge status={r.status} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!loading && total > pageSize && <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="Program pagination" />}
      </section>
    </div>
  )
}
