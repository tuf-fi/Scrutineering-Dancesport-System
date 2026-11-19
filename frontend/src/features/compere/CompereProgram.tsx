import { ProgramKind, ProgramStatus, type Class, type Discipline, type Program, type ProgramRow } from '@bis/shared'
import { StatusDot } from '../../components/StatusDot.tsx'
import { useCatalog } from '../../hooks/index.ts'
import { ROUND_TYPE_LABEL, eventDances, formatClock, programAction } from '../../lib/format.ts'

// What a line is, in the wall's two sizes: a round names its event, a break or the awarding names itself
function Name({ row }: { row: ProgramRow }) {
  if (row.kind !== ProgramKind.Round || row.eventNumber === null) return <>{row.label}</>
  return (
    <>
      <span className="mr-[1.2vmin] font-mono font-medium tabular-nums text-gold-400">E{row.eventNumber}</span>
      {eventDances(row)}
    </>
  )
}

// The round, the grade and what the announcer says aloud: how many are called back, or how many are placed
const detail = (row: ProgramRow, eventGrade: (event: { ageGroup: string; class: Class; discipline: Discipline }) => string) =>
  row.kind === ProgramKind.Round && row.roundType && row.ageGroup && row.class && row.discipline
    ? [
        ROUND_TYPE_LABEL[row.roundType],
        eventGrade({ ageGroup: row.ageGroup, class: row.class, discipline: row.discipline }),
        programAction(row),
      ].join(' · ')
    : ''

const WINDOW = 8

function Block({ title, status, row, empty, large }: { title: string; status: ProgramStatus; row: ProgramRow | undefined; empty: string; large: boolean }) {
  const { eventGrade } = useCatalog()
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-[1vmin]">
      <h2 className="flex items-center gap-[1.2vmin] font-mono text-[1.6vmin] font-medium uppercase tracking-[0.12em] text-brown-100">
        <StatusDot status={status} className="size-[1.5vmin]" />
        {title}
      </h2>
      {row ? (
        <>
          <p className={`text-balance font-semibold leading-[1.1] tracking-[-0.02em] text-white ${large ? 'text-[4.8vmin]' : 'text-[3.6vmin]'}`}>
            <Name row={row} />
          </p>
          <p className="flex flex-wrap gap-x-[1.8vmin] text-[2vmin] font-medium text-brown-100">
            <span className="font-mono tabular-nums text-white">{formatClock(row.startTime)}</span>
            {detail(row, eventGrade) && <span>{detail(row, eventGrade)}</span>}
          </p>
        </>
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

// The running order for the announcer: what is on the floor, what is next, and the lines around them
export function CompereProgram({ program, error }: { program: Program | undefined; error: boolean }) {
  const rows = program?.rows ?? []
  const now = rows.find((r) => r.status === ProgramStatus.Current)
  const nextIndex = rows.findIndex((r) => r.status === ProgramStatus.Next)
  const nowIndex = rows.findIndex((r) => r.status === ProgramStatus.Current)
  const anchor = nowIndex >= 0 ? nowIndex : nextIndex >= 0 ? nextIndex : rows.length
  const from = Math.max(0, anchor - 2)
  const lines = rows.slice(from, from + WINDOW)
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

  return (
    <div className="flex flex-1 flex-col gap-[3vmin]">
      <h1 className="sr-only">Program</h1>
      {now ? (
        <div className="grid grid-cols-2 gap-x-[4vmin] border-b border-white/15 pb-[2.4vmin]">
          <Block title="On the floor" status={ProgramStatus.Current} row={now} empty="" large />
          <div className="border-l border-white/15 pl-[4vmin]">
            <Block title="Up next" status={ProgramStatus.Next} row={rows[nextIndex]} empty={finished ? 'Nothing left' : 'Nothing queued'} large={false} />
          </div>
        </div>
      ) : (
        <div className="border-b border-white/15 pb-[2.4vmin]">
          <Block title="Up next" status={ProgramStatus.Next} row={rows[nextIndex]} empty={finished ? 'The program is complete' : 'Nothing queued'} large />
        </div>
      )}
      <section aria-label="Running order" className="flex flex-col">
        <ol className="flex flex-col">
          {lines.map((r) => (
            <li
              key={r.slotId}
              className={`flex items-center gap-[2.2vmin] border-b border-white/10 px-[1.2vmin] py-[0.9vmin] text-[2.3vmin] font-medium ${r.status === ProgramStatus.Completed ? 'text-white/45' : 'text-white'} ${r.status === ProgramStatus.Current ? 'bg-white/[0.06]' : ''}`}
            >
              <StatusDot status={r.status} className="size-[1.5vmin]" />
              <span className="w-[4vmin] shrink-0 font-mono tabular-nums text-brown-100">{r.sequence}</span>
              <span className="w-[15vmin] shrink-0 whitespace-nowrap font-mono tabular-nums text-brown-100">{formatClock(r.startTime)}</span>
              <span className="min-w-0 truncate">
                <Name row={r} />
              </span>
              <span className="ml-auto shrink-0 pl-[2vmin] text-right text-[2vmin] text-brown-100">{[r.roundType ? ROUND_TYPE_LABEL[r.roundType] : '', programAction(r)].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
