import { ProgramStatus, SubmissionStatus, type RoundRow } from '@bis/shared'
import { StatusDot } from '../../components/StatusDot.tsx'
import { ErrorState } from '../../components/ui/index.ts'
import { useCatalog, useCompetitionRounds, useLiveSubmissions } from '../../hooks/index.ts'
import { cn } from '../../lib/cn.ts'
import { ROUND_TYPE_LABEL, eventDances } from '../../lib/format.ts'

// One round on the floor: how many adjudicators have sent their marks, never the marks themselves
const LOOK = {
  solo: { label: 'text-[2.2vmin]', dances: 'text-[7vmin]', grade: 'text-[2.8vmin]', count: 'text-[11vmin]', of: 'text-[3.2vmin]', note: 'text-[2.8vmin]', bar: 'h-[1.3vmin]' },
  mid: { label: 'text-[2vmin]', dances: 'text-[4.6vmin]', grade: 'text-[2.4vmin]', count: 'text-[7.5vmin]', of: 'text-[2.6vmin]', note: 'text-[2.4vmin]', bar: 'h-[0.9vmin]' },
  small: { label: 'text-[1.8vmin]', dances: 'text-[3.6vmin]', grade: 'text-[2.1vmin]', count: 'text-[6vmin]', of: 'text-[2.2vmin]', note: 'text-[2.1vmin]', bar: 'h-[0.9vmin]' },
} as const
type Size = keyof typeof LOOK

function Card({ row, size }: { row: RoundRow; size: Size }) {
  const look = LOOK[size]
  const { eventGrade } = useCatalog()
  const submissions = useLiveSubmissions(row.roundId)
  const total = submissions.length
  const sent = submissions.filter((s) => s.status === SubmissionStatus.Submitted).length
  const done = total > 0 && sent === total

  return (
    <section aria-label={`E${row.eventNumber}`} className="flex min-w-0 flex-col justify-between gap-[1.8vmin] border-t border-white/20 pt-[1.6vmin]">
      <div className="flex flex-col gap-[1.2vmin]">
        <p className={cn('flex items-baseline gap-[1.4vmin] font-mono font-medium uppercase tracking-[0.12em] text-brown-100', look.label)}>
          <span className="tabular-nums text-gold-400">E{row.eventNumber}</span>
          {ROUND_TYPE_LABEL[row.type]}
        </p>
        <h2 className={cn('text-balance font-semibold leading-[1.05] tracking-[-0.03em] text-white', look.dances)}>{eventDances(row)}</h2>
        <p className={cn('font-medium text-brown-100', look.grade)}>{eventGrade({ ageGroup: row.ageGroup, class: row.class, discipline: row.discipline })}</p>
      </div>

      <div className="flex flex-col gap-[1.6vmin]">
        <p className="flex items-baseline gap-[1.4vmin] text-white" role="status">
          <span className={cn('font-mono font-semibold tabular-nums', look.count, done && 'text-gold-400')}>{sent}</span>
          <span className={cn('font-medium text-brown-100', look.of)}>of {total} adjudicators</span>
        </p>
        <div aria-hidden className="flex gap-[0.8vmin]">
          {submissions.map((s) => (
            <span key={s.adjudicatorId} className={cn('flex-1 rounded-full', look.bar, 'transition-colors duration-500', s.status === SubmissionStatus.Submitted ? 'bg-gold-400' : 'bg-white/15')} />
          ))}
        </div>
        <p className={cn('font-medium', look.note, done ? 'text-gold-400' : 'text-brown-100')}>{done ? 'All marks in. Results coming.' : 'Adjudicators are marking'}</p>
      </div>
    </section>
  )
}

// The rounds on the floor side by side, for the wall while the announcer waits for the results
export function CompereLive({ competitionId, quiet = false }: { competitionId: string; quiet?: boolean }) {
  const rounds = useCompetitionRounds(competitionId)
  const onFloor = (rounds.data ?? []).filter((r) => r.onFloor)

  if (rounds.isError && !rounds.data) return <ErrorState tone="dark" onRetry={() => void rounds.refetch()} />
  // Under the running order there is nothing to say when no round is on the floor
  if (onFloor.length === 0 && quiet) return null
  if (onFloor.length === 0) {
    return (
      <div className="flex flex-1 items-center">
        <h1 className="max-w-[18ch] text-balance text-[4.4vmin] font-semibold leading-[1.05] tracking-[-0.02em] text-white">{rounds.data ? 'No round is on the floor' : ''}</h1>
      </div>
    )
  }

  const grid = (
    <div className={cn('grid flex-1 content-center gap-x-[4vmin]', onFloor.length >= 5 ? 'gap-y-[3vmin]' : 'gap-y-[5vmin]', onFloor.length === 1 ? 'grid-cols-1' : onFloor.length === 2 || onFloor.length === 4 ? 'grid-cols-2' : 'grid-cols-3')}>
      {onFloor.map((row) => (
        <Card key={row.roundId} row={row} size={onFloor.length === 1 ? 'solo' : onFloor.length <= 4 ? 'mid' : 'small'} />
      ))}
    </div>
  )
  if (!quiet) return grid

  return (
    <section aria-label="On the floor" className="flex flex-col gap-[2vmin]">
      <h2 className="flex items-center gap-[1.2vmin] font-mono text-[1.6vmin] font-medium uppercase tracking-[0.12em] text-brown-100">
        <StatusDot status={ProgramStatus.Current} className="size-[1.5vmin]" />
        On the floor
      </h2>
      {grid}
    </section>
  )
}
