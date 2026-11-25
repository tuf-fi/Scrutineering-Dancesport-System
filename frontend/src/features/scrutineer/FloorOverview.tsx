import { ProgramStatus, RoundStatus, type RoundRow } from '@bis/shared'
import { StatusDot } from '../../components/StatusDot.tsx'
import { useCatalog } from '../../hooks/index.ts'
import { ROUND_TYPE_LABEL, eventCode, eventDances } from '../../lib/format.ts'

const ORDER = Object.keys(ROUND_TYPE_LABEL)

// The next round to start: the earliest round of the lowest-numbered event that has not started
function nextRound(rounds: RoundRow[]) {
  return [...rounds]
    .filter((r) => r.status === RoundStatus.Pending)
    .sort((a, b) => a.eventNumber - b.eventNumber || ORDER.indexOf(a.type) - ORDER.indexOf(b.type))[0]
}

// A banner on top of the chairperson's live board: the event that starts next
export function UpNext({ rounds }: { rounds: RoundRow[] }) {
  const { eventGrade } = useCatalog()
  const next = nextRound(rounds)

  return (
    <section aria-label="Up next" className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-gold-50 px-5 py-4">
      <h2 className="flex items-center gap-2.5 text-small font-bold uppercase tracking-wide text-neutral-900">
        <StatusDot status={ProgramStatus.Next} className="size-2" />
        Up next
      </h2>
      {next ? (
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="font-mono text-small font-medium tabular-nums text-gold-600">{eventCode({ number: next.eventNumber })}</span>
          <span className="text-body font-semibold text-neutral-900">{eventGrade({ ageGroup: next.ageGroup, class: next.class, discipline: next.discipline })}</span>
          <span className="text-small text-neutral-600">
            {ROUND_TYPE_LABEL[next.type]} · {eventDances(next)}
          </span>
        </p>
      ) : (
        <p className="text-body text-neutral-600">Nothing is waiting to start.</p>
      )}
    </section>
  )
}
