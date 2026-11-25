import { ProgramKind, ProgramStatus, type Program, type ProgramRow } from '@bis/shared'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { StatusDot } from '../../components/StatusDot.tsx'
import { RoundDetail } from './CompereRoundDetail.tsx'
import type { Paging } from './Pager.tsx'
import type { ShowRound } from './rounds.ts'
import { cn } from '../../lib/cn.ts'
import { useCatalog } from '../../hooks/index.ts'
import { ROUND_TYPE_LABEL, eventDances, formatClock, programAction } from '../../lib/format.ts'

// What a line is, in the wall's two sizes: a round names its event, a break or the awarding names itself
function Name({ row }: { row: ProgramRow }) {
  const { eventGrade } = useCatalog()
  if (row.kind !== ProgramKind.Round || row.eventNumber === null) return <>{row.label}</>
  return (
    <>
      <span className="mr-[1.2vmin] font-mono font-medium tabular-nums text-gold-400">E{row.eventNumber}</span>
      {row.ageGroup && row.class && row.discipline && eventGrade({ ageGroup: row.ageGroup, class: row.class, discipline: row.discipline })}
    </>
  )
}

// The round, the grade and what the announcer says aloud: how many are called back, or how many are placed
const detail = (row: ProgramRow) =>
  row.kind === ProgramKind.Round && row.roundType
    ? [ROUND_TYPE_LABEL[row.roundType], eventDances(row), programAction(row)].join(' · ')
    : ''

function Block({ title, status, rows, empty, large }: { title: string; status: ProgramStatus; rows: ProgramRow[]; empty: string; large: boolean }) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-[1vmin]">
      <h2 className="flex items-center gap-[1.2vmin] font-mono text-[1.6vmin] font-medium uppercase tracking-[0.12em] text-brown-100">
        <StatusDot status={status} className="size-[1.5vmin]" />
        {title}
      </h2>
      {rows.length > 0 ? (
        <ul className="flex flex-col gap-[2.2vmin]">
          {rows.map((row) => (
            <li key={row.slotId} className="flex flex-col gap-[1vmin]">
              <p className={`text-balance font-semibold leading-[1.1] tracking-[-0.02em] text-white ${large ? 'text-[4.8vmin]' : 'text-[3.6vmin]'}`}>
                <Name row={row} />
              </p>
              <p className="flex flex-wrap gap-x-[1.8vmin] text-[2vmin] font-medium text-brown-100">
                <span className="font-mono tabular-nums text-white">{formatClock(row.startTime)}</span>
                {detail(row) && <span>{detail(row)}</span>}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[3vmin] font-medium text-brown-100">{empty}</p>
      )}
    </section>
  )
}

// The wall is never blank: while the program loads these blocks hold its place
function Loading() {
  return (
    <div aria-busy="true" className="flex flex-1 flex-col gap-[5vmin]">
      {[10, 6].map((size) => (
        <div key={size} className="flex flex-col gap-[1.4vmin]">
          <div className="h-[2.8vmin] w-[16vmin] animate-pulse rounded-[0.6vmin] bg-white/10" />
          <div className="animate-pulse rounded-[1vmin] bg-white/10" style={{ height: `${size}vmin`, width: size === 10 ? '70%' : '50%' }} />
        </div>
      ))}
    </div>
  )
}

function Line({ row, round, open, onToggle }: { row: ProgramRow; round?: ShowRound; open?: boolean; onToggle?: () => void }) {
  const meta = [row.roundType ? ROUND_TYPE_LABEL[row.roundType] : '', row.kind === ProgramKind.Round ? eventDances(row) : '', programAction(row)].filter(Boolean).join(' · ')
  const tone = cn(
    'grid w-full items-center gap-x-[max(2.2vmin,0.75rem)] rounded-[1vmin] px-[max(2vmin,0.75rem)] py-[max(1.2vmin,0.6rem)] text-left',
    round ? 'grid-cols-[max(1.4vmin,0.5rem)_max(10vmin,4.75rem)_minmax(0,1fr)_auto]' : 'grid-cols-[max(1.4vmin,0.5rem)_max(10vmin,4.75rem)_minmax(0,1fr)]',
    row.status === ProgramStatus.Completed ? 'text-white/45' : 'text-white',
    row.status === ProgramStatus.Current && 'bg-white/[0.06]',
  )
  const inner = (
    <>
      <StatusDot status={row.status} className="size-[max(1.4vmin,0.5rem)]" />
      <span className="whitespace-nowrap font-mono text-[max(1.9vmin,0.8125rem)] font-medium tabular-nums text-brown-100">{formatClock(row.startTime)}</span>
      <span className="flex min-w-0 flex-col gap-[0.3vmin]">
        <span className="truncate text-[max(2.5vmin,0.9375rem)] font-semibold leading-tight">
          <Name row={row} />
        </span>
        {meta && <span className="truncate text-[max(1.7vmin,0.75rem)] font-medium text-brown-100">{meta}</span>}
      </span>
      {round && <ChevronDown aria-hidden className={cn('size-[max(2.4vmin,1rem)] text-brown-100 transition-transform', open && 'rotate-180')} />}
    </>
  )
  return round ? (
    <button type="button" aria-expanded={open} onClick={onToggle} className={cn(tone, 'transition-colors hover:bg-white/10')}>
      {inner}
    </button>
  ) : (
    <div className={tone}>{inner}</div>
  )
}

// The whole program, opening on the page of the round on the floor; a round opens to show its heats and couples
function FullProgram({ rows, rounds, paging, onGo }: { rows: ProgramRow[]; rounds: ShowRound[]; paging: Paging; onGo: (id: string) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <section aria-label="Program" className="flex flex-col gap-[2vmin]">
      <ol className="flex flex-col gap-[0.4vmin]">
        {rows.slice(paging.from, paging.to).map((r) => {
          const round = r.kind === ProgramKind.Round ? rounds.find((x) => x.eventNumber === r.eventNumber && x.roundType === r.roundType) : undefined
          const isOpen = open === r.slotId
          return (
            <li key={r.slotId}>
              <Line row={r} round={round} open={isOpen} onToggle={() => setOpen(isOpen ? null : r.slotId)} />
              {round && isOpen && <RoundDetail round={round} onGo={onGo} />}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// What is next; the rounds on the floor are the live cards above it, and the whole running order is the Program page
export function CompereProgram({ program, error, full = false, rounds = [], paging, onGo = () => {} }: { program: Program | undefined; error: boolean; full?: boolean; rounds?: ShowRound[]; paging?: Paging; onGo?: (id: string) => void }) {
  const rows = program?.rows ?? []
  const next = rows.filter((r) => r.status === ProgramStatus.Next).slice(0, 1)
  const finished = rows.length > 0 && rows.every((r) => r.status === ProgramStatus.Completed)

  if (error && !program) {
    return (
      <div className="flex flex-1 items-center">
        <h1 className="max-w-[20ch] text-balance text-[8vmin] font-semibold leading-[1.05] tracking-[-0.03em] text-white">
          The program could not load. Trying again.
        </h1>
      </div>
    )
  }
  if (!program) return <Loading />
  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center">
        <h1 className="max-w-[18ch] text-balance text-[10vmin] font-semibold leading-[1.02] tracking-[-0.035em] text-white">No program yet</h1>
      </div>
    )
  }

  if (full && paging) return <FullProgram rows={rows} rounds={rounds} paging={paging} onGo={onGo} />

  return (
    <div className="flex flex-1 flex-col gap-[3vmin]">
      <h1 className="sr-only">Program</h1>
      <div className="border-t border-white/15 pt-[2.4vmin]">
        <Block title="Up next" status={ProgramStatus.Next} rows={next} empty={finished ? 'The program is complete' : 'Nothing queued'} large={false} />
      </div>
    </div>
  )
}
