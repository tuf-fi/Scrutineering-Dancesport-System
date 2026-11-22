import { ProgramKind, ProgramStatus, RoundType, type ProgramRow, type RoundHeats } from '@bis/shared'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { ProgramStatusBadge } from '../../components/ProgramStatusBadge.tsx'
import { StatusDot, StatusLegend } from '../../components/StatusDot.tsx'
import { ButtonLink, EmptyState, ErrorState, Input, Skeleton } from '../../components/ui/index.ts'
import { useCatalog, useCompetition, useDocumentTitle, useEntriesByBackNumber, useRoundHeats, useProgram } from '../../hooks/index.ts'
import { cn } from '../../lib/cn.ts'
import { ROUND_TYPE_LABEL, eventCode, eventDances, formatClock, formatDate, programAction, todayIso } from '../../lib/format.ts'
import { OnTheFloor } from './OnTheFloor.tsx'
import { PublicHeader } from './PublicHeader.tsx'

const SHOWN = 10

const pad = (n: number) => String(n).padStart(3, '0')

// The heats of the round as back number chips, the same groups the announcer sees
function Detail({ round }: { round: RoundHeats }) {
  const many = round.heats.length > 1
  return (
    <div className="flex flex-col gap-5 px-4 pb-5 pt-1 sm:px-5">
      {round.heats.map((numbers, i) => (
        <section key={i} aria-label={many ? `Heat ${i + 1}` : 'Entries'} className="flex flex-col gap-3">
          <h4 className="flex items-baseline gap-3 text-small font-semibold text-neutral-900">
            {many ? `Heat ${i + 1}` : round.roundType === RoundType.Final ? 'Finalists' : 'All entries'}
            <span className="font-mono text-xs font-medium tabular-nums text-neutral-500">{numbers.length} entries</span>
          </h4>
          <ul className="flex flex-wrap gap-2">
            {numbers.map((n) => (
              <li key={n} className="rounded-md bg-neutral-900/[0.05] px-3 py-1.5 font-mono text-small font-medium tabular-nums text-neutral-900">
                {pad(n)}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

// The line of the program; with entries, the whole line opens and closes them
function RowHead({ row: r, grade, expandable, open, onToggle }: { row: ProgramRow; grade: string; expandable: boolean; open: boolean; onToggle: () => void }) {
  const inner = (
    <>
      <span className="col-span-2 flex items-center gap-2.5 font-mono text-xs tabular-nums text-neutral-500">
        <StatusDot status={r.status} />
        <span className="font-medium text-gold-700">{formatClock(r.startTime)}</span>
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        {r.kind === ProgramKind.Round && r.eventNumber !== null ? (
          <>
            <h3 className="font-semibold tracking-[-0.01em] text-neutral-900">
              <span className="mr-2 font-mono text-small font-medium tabular-nums text-neutral-500">{eventCode({ number: r.eventNumber })}</span>
              {eventDances(r)}
            </h3>
            <p className="text-small text-neutral-600">{[grade, r.roundType && ROUND_TYPE_LABEL[r.roundType], programAction(r)].filter(Boolean).join(' · ')}</p>
          </>
        ) : (
          <h3 className="font-semibold tracking-[-0.01em] text-neutral-900">{r.label}</h3>
        )}
      </div>
      <span className="flex items-center gap-3 self-start">
        <ProgramStatusBadge status={r.status} />
        {expandable && <ChevronDown aria-hidden className={cn('size-4 text-neutral-500 transition-transform duration-300', open && 'rotate-180')} strokeWidth={1.75} />}
      </span>
    </>
  )
  const base = 'grid w-full grid-cols-[1fr_auto] gap-x-6 gap-y-1 px-4 py-4 text-left sm:px-5'
  return expandable ? (
    <button type="button" aria-expanded={open} onClick={onToggle} className={cn(base, 'transition-colors hover:bg-neutral-50')}>
      {inner}
    </button>
  ) : (
    <div className={base}>{inner}</div>
  )
}

// One page for the day: what is on the floor, what comes next, and when a back number dances
export function LivePublicPage() {
  const { eventGrade } = useCatalog()
  const { competitionId = '' } = useParams()
  const competition = useCompetition(competitionId)
  const program = useProgram(competitionId)
  useDocumentTitle(competition.data ? `Live: ${competition.data.name}` : 'Live')
  const [back, setBack] = useState('')
  const [openSlot, setOpenSlot] = useState<string | null>(null)
  const number = /^\d+$/.test(back.trim()) ? Number(back) : null
  const mine = useEntriesByBackNumber(competitionId, number)
  const heats = useRoundHeats(competitionId)
  const heatsOf = (r: ProgramRow) => heats.data?.find((h) => h.eventId === r.eventId && h.roundType === r.roundType)

  if (competition.isError || program.isError) {
    return <ErrorState onRetry={() => void Promise.all([competition.refetch(), program.refetch()])} />
  }
  if (!competition.data) return <Skeleton className="h-24 w-full max-w-xl" />

  const past = competition.data.date < todayIso()
  const all = (program.data?.rows ?? []).map((r) => (past && r.kind === ProgramKind.Round ? { ...r, status: ProgramStatus.Completed } : r))
  const mineSet = number === null ? null : new Set(mine.data ?? [])
  const coming = all.filter((r) => r.status !== ProgramStatus.Completed)
  const rows = (mineSet ? coming.filter((r) => r.eventId !== null && mineSet.has(r.eventId)) : coming).slice(0, SHOWN)

  return (
    <div className="flex flex-col gap-8">
      <PublicHeader
        back={{ to: `/competitions/${competitionId}`, label: competition.data.name }}
        eyebrow={formatDate(competition.data.date)}
        title="Live board"
        description={<span className="block">{competition.data.venue}</span>}
        aside={
          <div className="flex gap-2">
            <ButtonLink to={`/competitions/${competitionId}/program`}>Full program</ButtonLink>
          </div>
        }
      />

      {program.isLoading ? <Skeleton className="h-28 w-full" /> : all.length > 0 && !past && <OnTheFloor rows={all} />}

      <Input label="Find a back number" inputMode="numeric" value={back} onChange={(e) => setBack(e.target.value)} className="max-w-xs font-mono tabular-nums" />

      <section aria-labelledby="coming-up" className="flex flex-col gap-4">
        <h2 id="coming-up" className="text-small font-bold uppercase tracking-wide text-neutral-900">
          {number === null ? 'Coming up' : `Back number ${number}`}
        </h2>
        {rows.length > 0 && <StatusLegend />}
        {program.isLoading || (number !== null && mine.isLoading) ? (
          <div aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-3 border-t border-neutral-200 py-5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-2/3 max-w-sm" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title={all.length === 0 ? 'No program yet' : number === null ? 'Nothing left to dance' : 'No rounds left'}
            description={
              all.length === 0 ? 'The running order appears here once the organizers publish it.' : number === null ? 'The program is complete.' : 'This back number has no rounds still to come.'
            }
          />
        ) : (
          <ul aria-label="Coming up" className="flex flex-col gap-3">
            {rows.map((r) => (
              <li key={r.slotId} className={cn('overflow-hidden rounded-xl border', r.status === ProgramStatus.Current ? 'border-gold-300 bg-gold-50' : 'border-neutral-200')}>
                <RowHead
                  row={r}
                  grade={r.ageGroup && r.class && r.discipline ? eventGrade({ ageGroup: r.ageGroup, class: r.class, discipline: r.discipline }) : ''}
                  expandable={(heatsOf(r)?.heats.flat().length ?? 0) > 0}
                  open={openSlot === r.slotId}
                  onToggle={() => setOpenSlot(openSlot === r.slotId ? null : r.slotId)}
                />
                {openSlot === r.slotId && heatsOf(r) && <Detail round={heatsOf(r)!} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
