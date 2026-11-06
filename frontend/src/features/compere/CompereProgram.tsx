import { ProgramKind, ProgramStatus, type Class, type Discipline, type Program, type ProgramRow } from '@bis/shared'
import { useCatalog } from '../../hooks/index.ts'
import { ROUND_TYPE_LABEL, eventDances, formatClock, programAction } from '../../lib/format.ts'

// What a line is, in the wall's two sizes: a round names its event, a break or the awarding names itself
function Name({ row }: { row: ProgramRow }) {
  if (row.kind !== ProgramKind.Round || row.eventNumber === null) return <>{row.label}</>
  return (
    <>
      <span className="mr-[1.6vmin] font-mono font-medium tabular-nums text-gold-400">E{row.eventNumber}</span>
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

function Block({ title, row, empty, large }: { title: string; row: ProgramRow | undefined; empty: string; large: boolean }) {
  const { eventGrade } = useCatalog()
  return (
    <section aria-label={title} className="flex flex-col gap-[1vmin]">
      <h2 className="text-[2.8vmin] font-semibold text-brown-100">{title}</h2>
      {row ? (
        <>
          <p className={`text-balance font-semibold leading-[1.05] tracking-[-0.03em] text-white ${large ? 'text-[10vmin]' : 'text-[6vmin]'}`}>
            <Name row={row} />
          </p>
          <p className={`flex flex-wrap gap-x-[2vmin] font-medium text-brown-100 ${large ? 'text-[3vmin]' : 'text-[2.6vmin]'}`}>
            <span className="font-mono tabular-nums text-white">{formatClock(row.startTime)}</span>
            {detail(row, eventGrade) && <span>{detail(row, eventGrade)}</span>}
          </p>
        </>
      ) : (
        <p className={`font-medium text-brown-100 ${large ? 'text-[6vmin]' : 'text-[4vmin]'}`}>{empty}</p>
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

// The running order for the announcer: what is on the floor, what is next, and the three lines after that
export function CompereProgram({ program, error }: { program: Program | undefined; error: boolean }) {
  const rows = program?.rows ?? []
  const now = rows.find((r) => r.status === ProgramStatus.Current)
  const nextIndex = rows.findIndex((r) => r.status === ProgramStatus.Next)
  const after = nextIndex >= 0 ? rows.slice(nextIndex + 1).filter((r) => r.status === ProgramStatus.Upcoming).slice(0, 3) : []
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
    <div className="flex flex-1 flex-col gap-[5vmin]">
      <h1 className="sr-only">Program</h1>
      <Block title="On the floor" row={now} empty={finished ? 'The program is complete' : 'Nothing on the floor'} large />
      <Block title="Up next" row={rows[nextIndex]} empty={finished ? 'Nothing left' : 'Nothing queued'} large={false} />
      {after.length > 0 && (
        <section aria-label="After that" className="flex flex-col gap-[1vmin]">
          <h2 className="text-[2.8vmin] font-semibold text-brown-100">After that</h2>
          <ol className="flex flex-col border-t border-white/10">
            {after.map((r) => (
              <li key={r.slotId} className="flex items-baseline gap-[3vmin] border-b border-white/10 py-[1vmin] text-[3vmin] font-medium text-white">
                <span className="w-[16vmin] shrink-0 font-mono tabular-nums text-brown-100">{formatClock(r.startTime)}</span>
                <span className="text-balance">
                  <Name row={r} />
                </span>
                <span className="ml-auto shrink-0 text-right text-[2.4vmin] text-brown-100">{[r.roundType ? ROUND_TYPE_LABEL[r.roundType] : '', programAction(r)].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
