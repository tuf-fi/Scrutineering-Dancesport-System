import { ProgramKind, ProgramStatus, type Program, type ProgramRow } from '@bis/shared'
import { ROUND_TYPE_LABEL, eventDances, eventGrade, formatClock } from '../../lib/format.ts'

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

const detail = (row: ProgramRow) =>
  row.kind === ProgramKind.Round && row.roundType && row.ageGroup && row.class && row.discipline
    ? `${ROUND_TYPE_LABEL[row.roundType]} · ${eventGrade({ ageGroup: row.ageGroup, class: row.class, discipline: row.discipline })}`
    : ''

function Block({ eyebrow, row, large }: { eyebrow: string; row: ProgramRow | undefined; large: boolean }) {
  return (
    <section aria-label={eyebrow} className="flex flex-col gap-[1vmin]">
      <p className="text-[2.4vmin] font-semibold uppercase tracking-[0.12em] text-brown-100">{eyebrow}</p>
      {row ? (
        <>
          <p className={`font-semibold leading-none tracking-[-0.03em] text-white ${large ? 'text-[10vmin]' : 'text-[6vmin]'}`}>
            <Name row={row} />
          </p>
          <p className={`flex flex-wrap gap-x-[2vmin] font-medium text-brown-100 ${large ? 'text-[3vmin]' : 'text-[2.6vmin]'}`}>
            <span className="font-mono tabular-nums text-white">{formatClock(row.startTime)}</span>
            {detail(row) && <span>{detail(row)}</span>}
          </p>
        </>
      ) : (
        <p className={`font-medium text-brown-100 ${large ? 'text-[6vmin]' : 'text-[4vmin]'}`}>Nothing yet</p>
      )}
    </section>
  )
}

// The running order for the announcer: what is on the floor, what is next, and the three lines after that
export function McProgram({ program }: { program: Program | undefined }) {
  const rows = program?.rows ?? []
  const now = rows.find((r) => r.status === ProgramStatus.Current)
  const nextIndex = rows.findIndex((r) => r.status === ProgramStatus.Next)
  const after = nextIndex >= 0 ? rows.slice(nextIndex + 1).filter((r) => r.status === ProgramStatus.Upcoming).slice(0, 3) : []

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center">
        <h1 className="max-w-[18ch] text-balance text-[10vmin] font-semibold leading-[1.02] tracking-[-0.035em] text-white">
          {program ? 'No program yet' : ''}
        </h1>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-[5vmin]">
      <h1 className="sr-only">Program</h1>
      <Block eyebrow="On the floor" row={now} large />
      <Block eyebrow="Up next" row={rows[nextIndex]} large={false} />
      {after.length > 0 && (
        <section aria-label="After that" className="flex flex-col gap-[1vmin]">
          <p className="text-[2.4vmin] font-semibold uppercase tracking-[0.12em] text-brown-100">After that</p>
          <ol className="flex flex-col border-t border-white/10">
            {after.map((r) => (
              <li key={r.slotId} className="flex items-baseline gap-[3vmin] border-b border-white/10 py-[1vmin] text-[3vmin] font-medium text-white">
                <span className="w-[16vmin] shrink-0 font-mono tabular-nums text-brown-100">{formatClock(r.startTime)}</span>
                <span className="truncate">
                  <Name row={r} />
                </span>
                <span className="ml-auto shrink-0 text-[2.4vmin] text-brown-100">{r.roundType ? ROUND_TYPE_LABEL[r.roundType] : ''}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
