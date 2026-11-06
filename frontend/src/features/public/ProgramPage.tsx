import { ProgramKind, ProgramStatus, RoundType, type ProgramRow } from '@bis/shared'
import { useState } from 'react'
import { useParams } from 'react-router'
import { ProgramStatusBadge } from '../../components/ProgramStatusBadge.tsx'
import { Button, ButtonLink, DarkPanel, EmptyState, ErrorState, Input, Pagination, SearchField, Select, Skeleton } from '../../components/ui/index.ts'
import { useCompetition, useEntriesByBackNumber, useProgram, useCatalog } from '../../hooks/index.ts'
import { usePagination } from '../../hooks/usePagination.ts'
import { cn } from '../../lib/cn.ts'
import {
  ROUND_TYPE_LABEL,
  eventCode,
  eventDances,
  formatClock,
  formatDate,
  letterRanges,
  programAction,
  todayIso,
} from '../../lib/format.ts'
import { PublicHeader } from './PublicHeader.tsx'
import { filterProgram, programPrintPath } from '../../lib/programFilter.ts'

const COLS = 'lg:grid-cols-[6rem_minmax(0,1.6fr)_minmax(0,1fr)_5rem_8rem]'

// The line itself in words, for the strip above the list
function Line({ label, row, empty }: { label: string; row: ProgramRow | undefined; empty: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <h2 className="font-mono text-[0.6875rem] font-medium uppercase tracking-wide text-gold-300">{label}</h2>
      {row ? (
        <>
          <p className="text-balance text-[1.125rem] font-semibold leading-[1.2] tracking-[-0.02em] text-white sm:text-[1.5rem]">
            {row.kind === ProgramKind.Round && row.eventNumber !== null ? (
              <>
                <span className="mr-2 font-mono font-medium text-white/65">{eventCode({ number: row.eventNumber })}</span>
                {eventDances(row)}
              </>
            ) : (
              row.label
            )}
          </p>
          <p className="text-xs text-white/60 sm:text-small sm:text-white/70">
            {formatClock(row.startTime)}
            {row.roundType && ` · ${ROUND_TYPE_LABEL[row.roundType]}`}
            {programAction(row) && ` · ${programAction(row)}`}
          </p>
        </>
      ) : (
        <p className="text-small text-white/60">{empty}</p>
      )}
    </div>
  )
}

// The running order of one competition, live: what is on the floor, what is next, and when everything else starts
export function ProgramPage() {
  const { eventGrade, ageGroupLabel } = useCatalog()
  const { competitionId = '' } = useParams()
  const competition = useCompetition(competitionId)
  const program = useProgram(competitionId)
  const [query, setQuery] = useState('')
  const [round, setRound] = useState('all')
  const [back, setBack] = useState('')
  // A back number is a whole number; anything else filters nothing
  const number = /^\d+$/.test(back.trim()) ? Number(back) : null
  const mine = useEntriesByBackNumber(competitionId, number)

  // A competition held on an earlier day is finished: every line reads Completed, whatever the round states say
  const past = competition.data ? competition.data.date < todayIso() : false
  const all = (program.data?.rows ?? []).map((r) => (past && r.kind === ProgramKind.Round ? { ...r, status: ProgramStatus.Completed } : r))
  const rows = filterProgram(all, query, round, number === null ? null : new Set(mine.data ?? []), ageGroupLabel)
  const { page, setPage, pageSize, total, pageItems } = usePagination(rows, `${query}|${round}|${back}`)

  if (competition.isError || program.isError) {
    return <ErrorState onRetry={() => void Promise.all([competition.refetch(), program.refetch()])} />
  }
  if (!competition.data) return <Skeleton className="h-24 w-full max-w-xl" />

  const now = all.find((r) => r.status === ProgramStatus.Current)
  const next = all.find((r) => r.status === ProgramStatus.Next)
  const finished = all.length > 0 && all.every((r) => r.status === ProgramStatus.Completed)
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
        aside={
          all.length > 0 && (
            <div className="flex gap-2">
              <ButtonLink to={programPrintPath(competitionId, query, round, false, back)} target="_blank">
                Print
              </ButtonLink>
              <ButtonLink variant="secondary" to={programPrintPath(competitionId, query, round, true, back)} target="_blank">
                PDF
              </ButtonLink>
            </div>
          )
        }
      />

      {program.isLoading ? (
        <Skeleton className="h-28 w-full" />
      ) : (
        all.length > 0 &&
        !past && (
          <DarkPanel
            aria-label="On the floor and up next"
            aria-live="polite"
            className="grid gap-4 divide-y divide-white/10 rounded-lg bg-black px-5 py-4 text-white sm:grid-cols-2 sm:gap-10 sm:divide-x sm:divide-y-0 sm:px-8 sm:py-7 [&>*:not(:first-child)]:pt-4 sm:[&>*:not(:first-child)]:pl-10 sm:[&>*:not(:first-child)]:pt-0"
          >
            <Line label="On the floor" row={now} empty={finished ? 'The program is complete' : 'Nothing on the floor right now'} />
            <Line label="Up next" row={next} empty={finished ? 'Nothing left' : 'Nothing queued'} />
          </DarkPanel>
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
              <span>Time</span>
              <span>Event</span>
              <span>Round / Action</span>
              <span>Dancing</span>
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
                  <span className="col-span-2 font-mono text-xs font-medium tabular-nums text-gold-700 lg:col-span-1">{formatClock(r.startTime)}</span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {r.kind === ProgramKind.Round && r.eventNumber !== null && r.ageGroup && r.class && r.discipline ? (
                      <>
                        <h3 className="font-semibold tracking-[-0.01em] text-neutral-900 lg:text-[1.0625rem]">
                          <span className="mr-2 font-mono text-small font-medium tabular-nums text-neutral-500">{eventCode({ number: r.eventNumber })}</span>
                          {eventDances(r)}
                        </h3>
                        <p className="text-small text-neutral-600">{eventGrade({ ageGroup: r.ageGroup, class: r.class, discipline: r.discipline })}</p>
                      </>
                    ) : (
                      <h3 className="font-semibold tracking-[-0.01em] text-neutral-900 lg:text-[1.0625rem]">{r.label}</h3>
                    )}
                  </div>
                  <p className="col-start-1 text-small text-neutral-600 lg:col-start-auto">
                    {[r.roundType && ROUND_TYPE_LABEL[r.roundType], programAction(r)].filter(Boolean).join(' · ')}
                    {r.panel.length > 0 && <span className="block font-mono text-xs">{letterRanges(r.panel)}</span>}
                  </p>
                  <span className="hidden font-mono text-small tabular-nums text-neutral-700 lg:block">{r.kind === ProgramKind.Round ? r.entryCount : ''}</span>
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
