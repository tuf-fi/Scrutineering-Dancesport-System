import { ProgramKind, ProgramStatus, type ProgramRow } from '@bis/shared'
import { DarkPanel } from '../../components/ui/index.ts'
import { ROUND_TYPE_LABEL, eventCode, eventDances, formatClock, programAction } from '../../lib/format.ts'

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

// What is on the floor and what is next, from the program rows
export function OnTheFloor({ rows }: { rows: ProgramRow[] }) {
  const now = rows.find((r) => r.status === ProgramStatus.Current)
  const next = rows.find((r) => r.status === ProgramStatus.Next)
  const finished = rows.length > 0 && rows.every((r) => r.status === ProgramStatus.Completed)
  return (
    <DarkPanel
      aria-label="On the floor and up next"
      aria-live="polite"
      className="grid gap-4 divide-y divide-white/10 rounded-lg bg-black px-5 py-4 text-white sm:grid-cols-2 sm:gap-10 sm:divide-x sm:divide-y-0 sm:px-8 sm:py-7 [&>*:not(:first-child)]:pt-4 sm:[&>*:not(:first-child)]:pl-10 sm:[&>*:not(:first-child)]:pt-0"
    >
      <Line label="On the floor" row={now} empty={finished ? 'The program is complete' : 'Nothing on the floor right now'} />
      <Line label="Up next" row={next} empty={finished ? 'Nothing left' : 'Nothing queued'} />
    </DarkPanel>
  )
}
